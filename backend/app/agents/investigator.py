"""Investigator: ADK LlmAgent with plant tools, then a structured 4M+1E matrix.

Live: ADK (google-adk) agent on GEMINI_MODEL calls the tools below; each tool call is
written to the case trace immediately. A separate google-genai call with
response_schema=Matrix structures the result. Code then validates citations, applies
the rule verdicts, and fills pressurePath, autostart and impact from the rules.
Cached (AI_MODE=cached, or any live error or timeout): replays the trace of
fixtures/case_C0412_open.json with short pauses and writes the open-state diagnosis.
"""
from __future__ import annotations

import asyncio
import copy
import json
import logging
import random
import threading
import time
from typing import Any, Callable, Optional

from ..config import PROMPT_VERSION, get_settings
from ..models import Matrix
from ..rules import autostart as autostart_rule
from ..rules import loss as loss_rule
from ..rules import pressure_path as pp_rule
from ..services import data
from ..services.bigquery import BQ_METHOD, run_detection
from ..services.store import get_store
from .common import (CATEGORIES, LiveUnavailable, TraceWriter, call_with_timeout, generate_structured,
                     genai_client, validate_matrix)
from .context import rule_results, signals_summary

log = logging.getLogger("lubeguard.investigator")

EVIDENCE_REQUESTS = {
    "material": {"instruction": "Take an oil sample from the reservoir drain into a clear bottle and photograph it "
                                "against a light. Add a short voice note.", "sopRef": "SOP-LO-04 §2"},
    "environment": {"instruction": "Photograph the oil-side and cooling-water-side gauges of cooler E-101A.",
                    "sopRef": "SOP-LO-03 §3"},
    "machine": {"instruction": "After changeover, photograph the removed filter element.", "sopRef": "SOP-LO-02 §4"},
    "method": {"instruction": "Photograph the last auto-start test record for P-104B and P-105.",
               "sopRef": "SOP-LO-05 §4"},
    "man": {"instruction": "Photograph the operator log page for the last two shifts.", "sopRef": "SOP-LO-02 §1"},
}

WATER_ROOT_CAUSE = {
    "text": ("Cooling water is leaking through oil cooler E-101A, emulsifying the oil; the sludge loads filter "
             "F-101A and starves the header, raising bearing 1 temperature. Changing the filter alone would "
             "treat the symptom."),
    "path": ["E-101A", "OIL", "F-101A", "HEADER", "BRG-1"],
}
FILTER_ROOT_CAUSE = {
    "text": ("Filter F-101A is loading with particles; the oil is clear and bright, so water ingress is not "
             "supported. Change over the filter and test the auto-start chain."),
    "path": ["F-101A", "HEADER", "BRG-1"],
}

_running: dict[tuple[str, str], threading.Lock] = {}
_running_guard = threading.Lock()

SYSTEM_PROMPT = """You are the LubeGuard Investigator for the lube-oil console LO-01 of steam turbine ST-01
(synthetic demo plant). Walk the pressure path: pump P-104A, duplex filter F-101A/B, cooler E-101A/B,
PCV-101, header PT-104, bearings. Use the tools; never invent numbers: every number comes from a tool.
Call: query_signals, classify_pressure_path, get_asset_context (F-101A and P-104A), get_pump_motor_health,
check_autostart_readiness, get_oil_lab_results, search_similar_incidents (F2 and F12),
get_field_evidence, get_graph_neighbourhood (F-101A). Then write short findings per 4M+1E category
(man, machine, method, material, environment). If a category lacks fresh evidence, say it is
UNVERIFIED and name the field evidence that would settle it. Keep it under 200 words."""

STRUCTURE_PROMPT = """Structure the investigation into a 4M+1E matrix (man, machine, method, material,
environment). Each cell: verdict G (good), NG (not good) or UNVERIFIED; one-sentence evidence; citations.
Rules:
- Cite ONLY ids from ALLOWED_IDS (rule ids, SOP section ids written exactly like 'SOP-LO-04 §2',
  incident ids, evidence ids). A verdict without a valid citation becomes UNVERIFIED.
- Never invent numbers; copy numbers from TOOL_RESULTS.
- If there is no field evidence and the last lab sample is old, Material must be UNVERIFIED.
- provenance is 'ai' unless the finding comes from an engineer's photo or voice note ('human')."""


# ---------------------------------------------------------------- tool context
class InvestigationContext:
    def __init__(self, sid: str, case: dict, writer: TraceWriter) -> None:
        self.sid = sid
        self.case = case
        self.writer = writer
        self.rules = rule_results(case)
        self.results: dict[str, Any] = {}

    def record(self, step: str, summary: str, result: Any) -> Any:
        self.results[step] = result
        self.writer.write(step, summary)
        return result


def build_tools(ctx: InvestigationContext) -> list[Callable]:
    """Python function tools for the ADK agent (and the genai fallback). Each call is traced."""

    def query_signals(days: int) -> dict:
        """Pull the hourly lube-oil signals for the last N days (PT-104, PDT-101, LT-101, TE-201, IT-104A,
        PT-106, VT-104A, TT-102) with first, last, min, max and slope per day, plus per-signal anomaly flags.

        Args:
            days: number of days of history to summarise (use 6).
        """
        d = max(1, min(int(days or 6), 14))
        summary = signals_summary(ctx.case, d)
        det = run_detection("hero")
        res = {"signals": summary, "detection": det, "syntheticData": True}
        tags = ", ".join(t for t in summary if t != "WATER-PPM")
        return ctx.record("query_signals", f"Pulled {d} days of {tags}", res)

    def classify_pressure_path() -> dict:
        """Run rule R-T5 (pressure-path classifier) on the signal slopes: filter loading, pump or relief
        valve, external leak, water ingress, hot oil or cooler, instrument drift or normal."""
        r = ctx.rules["pressurePath"]
        d = r["directions"]
        word = {"down": "down", "up": "up", "flat": "flat"}
        text = (f"R-T5: header {word.get(d['PT-104'], d['PT-104'])}, filter dP {word.get(d['PDT-101'], d['PDT-101'])}, "
                f"discharge {word.get(d['PT-106'], d['PT-106'])}: {r['label'].lower()}")
        return ctx.record("classify_pressure_path", text, r)

    def get_oil_lab_results() -> dict:
        """Return the last oil lab samples and their evaluation against R-T1 (oil limits) and R-T2 (ISO 4406)."""
        lab = ctx.rules["lab"]
        s = lab["sample"]
        state = "normal then" if lab["result"]["verdict"] == "G" else lab["result"]["label"]
        text = (f"Last lab sample {lab['ageDays']} days ago: {s.get('waterPpm')} ppm water, "
                f"ISO {s.get('iso4406')}: {state}")
        return ctx.record("get_oil_lab_results", text, {**lab, "samples": data.oil_lab()})

    def check_autostart_readiness() -> dict:
        """Run rule R-T4: margin of header pressure PT-104 to PSL-104 (standby start) and the age of the last
        P-104B / P-105 auto-start test against the SOP interval."""
        a = ctx.rules["autostart"]
        text = (f"Last auto-start test {a['lastTestDays']} days ago (SOP {a['sopIntervalDays']} days); "
                f"margin {a['marginToPslBar']:.1f} bar to PSL-104")
        return ctx.record("check_autostart_readiness", text, {**a, "tests": data.autostart_tests()})

    def get_asset_context(component_id: str) -> dict:
        """Return maintenance context and graph neighbours for a component id such as F-101A, P-104A, E-101A.

        Args:
            component_id: knowledge-graph component id, for example F-101A.
        """
        cid = (component_id or "F-101A").strip().upper()
        facts = data.ASSET_CONTEXT.get(cid, {})
        nb = data.neighbourhood([cid], hops=1, limit=20)
        f = data.ASSET_CONTEXT["F-101A"]
        p = data.ASSET_CONTEXT["P-104A"]
        text = (f"F-101A element in service {f['elementInServiceDays']} days; "
                f"P-104A last serviced {p['lastServiceDays']} days ago")
        res = {"component": cid, "facts": facts, "neighbours": [n["id"] for n in nb["nodes"]],
               "related": {"F-101A": f, "P-104A": p}}
        if "get_asset_context" in ctx.results:
            ctx.results.setdefault("get_asset_context_more", []).append(res)
            return res
        return ctx.record("get_asset_context", text, res)

    def get_pump_motor_health() -> dict:
        """Run rules R-P1 (ISO 10816-7 vibration zones) and R-P8 (motor current vs FLA x SF) for P-104A."""
        p = ctx.rules["pump"]
        return ctx.record("get_pump_motor_health", p["label"], p)

    def search_similar_incidents(failure_mode: str) -> dict:
        """Find past incidents of this plant by failure mode id (F1 to F12) or label words
        (for example 'water ingress', 'bearing wipe').

        Args:
            failure_mode: failure mode id like F2, or words from its label.
        """
        q = (failure_mode or "").strip().lower()
        fms = data.failure_modes()
        ids = {k for k, v in fms.items() if k.lower() == q or (q and q in v.lower())}
        hits = [i for i in data.incidents() if i["failureMode"] in ids]
        if not hits and q:
            hits = [i for i in data.incidents() if q in i["description"].lower()]
        prev = ctx.results.get("search_similar_incidents", {"incidents": []})
        merged = {i["id"]: i for i in prev["incidents"] + hits}
        res = {"incidents": list(merged.values())}
        notes = {"INC-2022-031": "bearing wipe, emulsified sludge", "INC-2024-017": "cooler water ingress"}
        ranked = sorted(merged.values(), key=lambda i: (i["id"] not in notes, i["id"]))[:2]
        text = "Similar: " + ", ".join(f"{i['id']} ({notes.get(i['id'], i['failureModeLabel'].lower())})"
                                       for i in ranked) if ranked else "No similar incidents"
        if "search_similar_incidents" in ctx.results:
            ctx.results["search_similar_incidents"] = res
            return res
        return ctx.record("search_similar_incidents", text, res)

    def get_field_evidence() -> dict:
        """Return the engineer's field evidence (photos, voice notes) already attached to the case."""
        ev = ctx.case.get("evidence") or []
        text = f"{len(ev)} field evidence items" if ev else "No field evidence yet"
        return ctx.record("get_field_evidence", text, {"evidence": ev})

    def get_graph_neighbourhood(node_id: str) -> dict:
        """Return the 2-hop knowledge-graph neighbourhood of a node (component, tag, failure mode, SOP section).

        Args:
            node_id: knowledge-graph node id, for example F-101A.
        """
        nid = (node_id or "F-101A").strip()
        nb = data.neighbourhood([nid], hops=2, limit=40)
        text = "F-101A, OIL, E-101A, HEADER, BRG-1 and linked SOP sections"
        res = {"nodes": [{"id": n["id"], "type": n["type"], "label": n["label"]} for n in nb["nodes"]],
               "edges": nb["edges"]}
        return ctx.record("get_graph_neighbourhood", text, res)

    return [query_signals, classify_pressure_path, get_asset_context, get_pump_motor_health,
            check_autostart_readiness, get_oil_lab_results, search_similar_incidents,
            get_field_evidence, get_graph_neighbourhood]


# ---------------------------------------------------------------- ADK agent
def build_adk_agent(tools: list[Callable]):
    """Construct the ADK LlmAgent (no API call)."""
    from google.adk.agents import LlmAgent

    return LlmAgent(name="lubeguard_investigator", model=get_settings().gemini_model,
                    description="Walks the lube-oil pressure path with plant tools",
                    instruction=SYSTEM_PROMPT, tools=tools)


def _run_adk(agent, prompt: str) -> str:
    from google.adk.runners import InMemoryRunner
    from google.genai import types

    async def _go() -> str:
        runner = InMemoryRunner(agent=agent, app_name="lubeguard")
        session = await runner.session_service.create_session(app_name="lubeguard", user_id="investigator")
        final = ""
        msg = types.Content(role="user", parts=[types.Part(text=prompt)])
        async for event in runner.run_async(user_id="investigator", session_id=session.id, new_message=msg):
            if event.is_final_response() and event.content and event.content.parts:
                final = "".join(p.text or "" for p in event.content.parts if getattr(p, "text", None))
        return final

    return asyncio.run(_go())


def _run_genai_afc(tools: list[Callable], prompt: str) -> str:
    """Fallback loop: google-genai automatic function calling over the same tools."""
    from google.genai import types

    client = genai_client()
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT, tools=tools, temperature=0.2,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(maximum_remote_calls=14))
    resp = client.models.generate_content(model=get_settings().gemini_model, contents=prompt, config=config)
    return resp.text or ""


def _agent_prompt(case: dict) -> str:
    return (f"Case {case['id']}: {case['title']} on {case['asset']['name']}. Detection flagged: "
            + ", ".join(t["tag"] for t in (case.get("detection") or {}).get("tags", []) if t.get("anomalous"))
            + ". Investigate with the tools and report findings per 4M+1E category.")


def _allowed_ids(case: dict) -> list[str]:
    ev = [e["id"] for e in case.get("evidence") or []]
    return (data.RULE_IDS + sorted(data.sop_section_ids()) + [i["id"] for i in data.incidents()] + ev)


def structure_matrix_live(case: dict, tool_results: dict, notes: str, extra: str = "") -> dict:
    payload = {
        "CASE": {"id": case["id"], "title": case["title"], "asset": case["asset"]},
        "TOOL_RESULTS": tool_results,
        "INVESTIGATOR_NOTES": notes,
        "FIELD_EVIDENCE": case.get("evidence") or [],
        "ALLOWED_IDS": _allowed_ids(case),
    }
    prompt = STRUCTURE_PROMPT + ("\n" + extra if extra else "") + "\n\n" + json.dumps(payload, default=str)[:60000]
    m = generate_structured(prompt, Matrix)
    return m.model_dump(mode="json")


# ---------------------------------------------------------------- guards
def apply_rule_guards(matrix: dict, rules: dict, evidence: list[dict]) -> dict:
    """Rule verdicts win over the model; Material stays UNVERIFIED without fresh evidence."""
    m = copy.deepcopy(matrix)
    pp = rules["pressurePath"]
    if pp["mechanism"] in ("filter_loading", "pump_or_relief_valve", "external_leak") and m["machine"]["verdict"] != "NG":
        m["machine"] = {"verdict": "NG", "evidence": f"{pp['label']} (R-T5): {pp['evidence']}",
                        "citations": ["R-T5"], "provenance": "ai"}
    au = rules["autostart"]
    if au["verdict"] == "NG" and m["method"]["verdict"] != "NG":
        m["method"] = {"verdict": "NG", "evidence": f"{au['label']} (R-T4)",
                       "citations": ["R-T4", "SOP-LO-05 §1"], "provenance": "ai"}
    judged = [e for e in evidence if e.get("judged")]
    lab_age = rules["lab"].get("ageDays") or 999
    if not judged and lab_age > 14 and m["material"]["verdict"] != "UNVERIFIED":
        s = rules["lab"]["sample"]
        m["material"] = {"verdict": "UNVERIFIED",
                         "evidence": (f"Last lab sample {lab_age} days ago was normal ({s.get('waterPpm')} ppm water). "
                                      "No fresh field evidence of oil condition"),
                         "citations": ["R-T1"], "provenance": "ai"}
    return m


def _summary_line(matrix: dict) -> str:
    names = {"man": "Man", "machine": "Machine", "method": "Method", "material": "Material", "environment": "Environment"}
    parts = [f"{names[c]} {matrix[c]['verdict']}" for c in CATEGORIES if matrix[c]["verdict"] != "G"]
    return "4M+1E: " + (", ".join(parts) if parts else "all categories G")


def _evidence_requests(matrix: dict, existing: list[dict]) -> list[dict]:
    reqs = [r for r in existing if r.get("ticketId")]
    have = {r["category"] for r in reqs}
    if matrix["material"]["verdict"] == "UNVERIFIED" and "material" not in have:
        reqs.append({"category": "material", **EVIDENCE_REQUESTS["material"], "ticketId": None})
    return reqs


def _apply_rule_fields(case: dict, rules: dict) -> None:
    case["pressurePath"] = pp_rule.to_model_fields(rules["pressurePath"])
    case["autostart"] = autostart_rule.to_model_fields(rules["autostart"])
    case["impact"] = loss_rule.to_model_fields(rules["impact"])


# ---------------------------------------------------------------- flows
def _pause() -> None:
    scale = get_settings().replay_delay_scale
    if scale > 0:
        time.sleep(random.uniform(0.6, 1.2) * scale)


def _cached_investigation(sid: str, case: dict, base_trace: list[dict], fast: bool = False) -> dict:
    fixture = data.load_fixture("case_C0412_open")
    writer = TraceWriter(sid, case["id"])
    rules = rule_results(case)
    for entry in fixture["trace"]:
        if entry["step"] == "case_opened":
            continue
        if not fast:
            _pause()
        writer.write(entry["step"], entry["summary"], entry.get("provenance", "ai"))
    matrix, _ = validate_matrix(fixture["diagnosis"]["matrix"], [e["id"] for e in case.get("evidence") or []])
    case["diagnosis"] = {"matrix": matrix, "rootCause": None,
                         "evidenceRequests": _evidence_requests(matrix, case.get("diagnosis", {}).get("evidenceRequests", []))}
    _apply_rule_fields(case, rules)
    case["trace"] = base_trace + writer.entries
    return case


def _live_investigation(sid: str, case: dict, base_trace: list[dict]) -> dict:
    s = get_settings()
    cancel = threading.Event()
    writer = TraceWriter(sid, case["id"], cancel)
    ctx = InvestigationContext(sid, case, writer)
    tools = build_tools(ctx)
    prompt = _agent_prompt(case)
    try:
        agent = build_adk_agent(tools)
        runner_fn: Callable[[], str] = lambda: _run_adk(agent, prompt)  # noqa: E731
    except Exception as exc:  # ADK not usable: same loop with google-genai AFC
        log.warning("ADK unavailable (%s); using google-genai automatic function calling", exc)
        runner_fn = lambda: _run_genai_afc(tools, prompt)  # noqa: E731
    genai_client()  # raises LiveUnavailable without a key
    notes = call_with_timeout(runner_fn, timeout=s.live_timeout_s, cancel=cancel)
    raw = call_with_timeout(structure_matrix_live, case, ctx.results, notes, timeout=s.live_timeout_s, cancel=cancel)
    ev_ids = [e["id"] for e in case.get("evidence") or []]
    matrix, downgraded = validate_matrix(raw, ev_ids)
    matrix = apply_rule_guards(matrix, ctx.rules, case.get("evidence") or [])
    matrix, _ = validate_matrix(matrix, ev_ids)
    writer.write("structure_matrix", _summary_line(matrix)
                 + (f" (downgraded: {', '.join(downgraded)})" if downgraded else ""))
    reqs = _evidence_requests(matrix, case.get("diagnosis", {}).get("evidenceRequests", []))
    if any(r["category"] == "material" and not r.get("ticketId") for r in reqs):
        writer.write("evidence_request", "Material unverified: request oil sample photo (SOP-LO-04 §2)")
    det = ctx.results.get("query_signals", {}).get("detection")
    if det:
        case["detection"] = {**(case.get("detection") or {}), "method": det["method"], "tags": det["tags"]}
    case["diagnosis"] = {"matrix": matrix, "rootCause": None, "evidenceRequests": reqs}
    _apply_rule_fields(case, ctx.rules)
    case["trace"] = base_trace + writer.entries
    return case


def investigate(sid: str, case_id: str) -> dict:
    """Run the investigation and return the written Case dict (status awaiting_evidence)."""
    store = get_store()
    key = (sid, case_id)
    with _running_guard:
        lock = _running.setdefault(key, threading.Lock())
    if not lock.acquire(blocking=False):
        return store.get_case(sid, case_id)  # already running: clients follow the live trace
    try:
        case = store.get_case(sid, case_id)
        if case is None:
            raise KeyError(case_id)
        base_trace = [t for t in case.get("trace", []) if t.get("step") == "case_opened"]
        case["status"] = "investigating"
        case["trace"] = base_trace
        store.put_case(sid, case)
        s = get_settings()
        case["audit"] = {"model": s.gemini_model, "promptVersion": PROMPT_VERSION, "cached": True}
        if s.live:
            try:
                case = _live_investigation(sid, copy.deepcopy(case), base_trace)
                case["audit"]["cached"] = False
            except Exception as exc:
                log.warning("live investigation failed, cached fallback: %s", exc)
                current = store.get_case(sid, case_id) or case
                case["trace"] = base_trace
                store.put_case(sid, {**current, "trace": base_trace})
                TraceWriter(sid, case_id).write("fallback", "Live AI step failed or timed out; showing cached result")
                fb = store.get_case(sid, case_id)["trace"]
                case = _cached_investigation(sid, case, fb, fast=True)
                case["audit"]["cached"] = True
        else:
            case = _cached_investigation(sid, case, base_trace)
        case["status"] = "awaiting_evidence"
        store.put_case(sid, case)
        return case
    finally:
        lock.release()


# ---------------------------------------------------------------- evidence restructure
def restructure_with_evidence(sid: str, case: dict, writer: TraceWriter) -> tuple[dict, dict, bool]:
    """Re-run the structuring step with the case's judged evidence.

    Returns (matrix, rootCause, cached).
    """
    evidence = case.get("evidence") or []
    ev_ids = [e["id"] for e in evidence]
    judged = [e for e in evidence if e.get("judged") and e.get("kind") in ("photo", "voice")]
    ng = [e for e in judged if e["judged"]["verdict"] == "NG"]
    water = bool(ng)
    rules = rule_results(case, oil_haze=water)
    cached = True
    matrix: Optional[dict] = None
    s = get_settings()
    if s.live:
        try:
            genai_client()
            extra = ("FIELD_EVIDENCE has been judged. Update Material and Environment from it; cite the evidence ids. "
                     "If the oil is hazy or milky, water ingress through cooler E-101A is the leading source.")
            tool_results = {"rules": {k: v for k, v in rules.items()}, "previousMatrix": (case.get("diagnosis") or {}).get("matrix")}
            raw = call_with_timeout(structure_matrix_live, case, tool_results, "", extra, timeout=s.live_timeout_s)
            matrix, _ = validate_matrix(raw, ev_ids)
            cached = False
        except Exception as exc:
            log.warning("live restructure failed, cached fallback: %s", exc)
            matrix = None
    if matrix is None:
        if water:
            fx = data.load_fixture("case_C0412_evidence")["diagnosis"]["matrix"]
            fx["material"]["citations"] = ["R-T1", *[e["id"] for e in ng], "SOP-LO-04 §2"]
            matrix = fx
        else:
            base = copy.deepcopy((case.get("diagnosis") or {}).get("matrix")
                                 or data.load_fixture("case_C0412_open")["diagnosis"]["matrix"])
            matrix = base
    # evidence verdicts are human-grounded and settle Material
    if judged:
        if water:
            m = matrix["material"]
            cites = list(dict.fromkeys([*m.get("citations", []), "R-T1", *[e["id"] for e in ng], "SOP-LO-04 §2"]))
            if m.get("verdict") != "NG":
                m = {"verdict": "NG", "evidence": ("Engineer photo: oil not clear and bright, milky haze; free water "
                                                  "suspected (above 0.1% limit for steam turbines likely)")}
            matrix["material"] = {**m, "verdict": "NG", "citations": cites, "provenance": "human"}
        else:
            g = [e["id"] for e in judged]
            matrix["material"] = {"verdict": "G", "evidence": "Engineer photo: oil clear and bright; no free water visible",
                                  "citations": ["R-T1", *g, "SOP-LO-04 §2"], "provenance": "human"}
    matrix = apply_rule_guards(matrix, rules, evidence)
    matrix, _ = validate_matrix(matrix, ev_ids)
    root = copy.deepcopy(WATER_ROOT_CAUSE if water else FILTER_ROOT_CAUSE)
    summary = ("Material NG, Environment NG; root cause: cooler E-101A leaking water" if water and matrix["environment"]["verdict"] == "NG"
               else ("Material NG; root cause: water entering the oil" if water
                     else "Material G (clear and bright); root cause: filter F-101A loading"))
    writer.write("structure_matrix", summary)
    return matrix, root, cached


def bq_method_label() -> str:
    return BQ_METHOD
