"""Advisor: corrective actions with SOP citations validated in code.

Gemini drafts actions from the 8 SOPs, the matrix and the root cause. Code then:
- drops SOP citations that do not exist; an action without a valid citation gets the single
  step "Escalate to on-call engineer" and the escalate quadrant,
- sets quadrant, authority and timing from authority.json via the action kind (not the model),
- sets the assignee from raci.json.
Cached: the five actions A1 to A5 of fixtures/case_C0412_evidence.json (through the same checks).
"""
from __future__ import annotations

import json
import logging
from typing import Literal, Optional

from pydantic import BaseModel, Field

from ..config import get_settings
from ..services import data
from .common import call_with_timeout, generate_structured, genai_client

log = logging.getLogger("lubeguard.advisor")

ActionKind = Literal["filter_changeover", "cooler_changeover", "autostart_test", "oil_purification",
                     "cooler_retube", "piping_modification", "other"]

KIND_ASSET_CLASS = {
    "filter_changeover": "lube_oil_filter",
    "cooler_changeover": "lube_oil_cooler",
    "cooler_retube": "lube_oil_cooler",
    "autostart_test": "autostart_circuit",
    "oil_purification": "lube_oil",
    "piping_modification": "lube_oil",
    "other": "lube_oil",
}
KIND_COMPONENT = {
    "filter_changeover": "F-101A", "cooler_changeover": "E-101A", "cooler_retube": "E-101A",
    "autostart_test": "PSL-104", "oil_purification": "TK-01", "piping_modification": "HEADER", "other": "LO-01",
}
CACHED_KINDS = {"A1": "filter_changeover", "A2": "cooler_changeover", "A3": "autostart_test",
                "A4": "oil_purification", "A5": "cooler_retube"}
ESCALATE_STEP = "Escalate to on-call engineer"


class DraftAction(BaseModel):
    title: str
    category: Literal["man", "machine", "method", "material", "environment"]
    kind: ActionKind
    sopCitations: list[str] = Field(default_factory=list)
    steps: list[str] = Field(default_factory=list)


class AdvisorDraft(BaseModel):
    actions: list[DraftAction]


PROMPT = """You are the LubeGuard Advisor for lube-oil console LO-01 (synthetic demo plant).
Propose 3 to 6 corrective actions that address every NG category of the 4M+1E matrix and the root cause.
For each action give: title (imperative, short), category, kind (one of filter_changeover,
cooler_changeover, autostart_test, oil_purification, cooler_retube, piping_modification, other),
sopCitations written exactly like 'SOP-LO-02 §3.1' and only from the SOP texts below, and 2 to 4 short steps
taken from the cited SOP sections. Order: actions that can run now without downtime first.
Do not invent numbers that are not in the SOPs."""


def _raci_role(kind: str) -> str:
    cls = KIND_ASSET_CLASS.get(kind, "lube_oil")
    for rule in data.raci()["rules"]:
        if rule["assetClass"] == cls:
            return rule["R"]
    return "engineer"


def finalize_actions(drafts: list[dict]) -> list[dict]:
    """Apply citation validation, authority table, timing rule and RACI in code."""
    valid_sops = data.sop_section_ids()
    auth = data.authority()
    out = []
    for i, d in enumerate(drafts, start=1):
        kind = d.get("kind") or "other"
        cites = [data.normalize_citation(c) for c in d.get("sopCitations") or []]
        cites = list(dict.fromkeys(c for c in cites if c in valid_sops))
        rule = auth.get(kind, {"level": "plant", "needsCapex": False, "needsShutdown": False})
        level = rule["level"]
        timing = "next_shutdown" if rule.get("needsShutdown") else "now"
        if not cites:
            quadrant, steps = "escalate", [ESCALATE_STEP]
        elif level == "shift" and not rule.get("needsCapex"):
            quadrant, steps = "quick_win", d.get("steps") or []
        else:
            quadrant, steps = "major", d.get("steps") or []
        out.append({
            "id": d.get("id") or f"A{i}",
            "title": d["title"],
            "category": d["category"],
            "quadrant": quadrant,
            "authority": level,
            "timing": timing,
            "sopCitations": cites,
            "steps": steps or [ESCALATE_STEP],
            "assigneeRole": _raci_role(kind),
            "ticketType": "safety_test" if kind == "autostart_test" else "corrective",
        })
    return out


def action_kind(action: dict) -> str:
    if action.get("id") in CACHED_KINDS and action.get("title", "").lower().startswith(
            ("switch", "isolate", "run auto", "start oil", "plug")):
        return CACHED_KINDS[action["id"]]
    t = action.get("title", "").lower()
    if "filter" in t:
        return "filter_changeover"
    if "retube" in t or "plug" in t:
        return "cooler_retube"
    if "cooler" in t:
        return "cooler_changeover"
    if "auto-start" in t or "autostart" in t:
        return "autostart_test"
    if "purif" in t or "dehydrat" in t:
        return "oil_purification"
    return "other"


def cached_actions(water: bool = True) -> list[dict]:
    fixture = data.load_fixture("case_C0412_evidence")["decision"]["actions"]
    drafts = [{**a, "kind": CACHED_KINDS.get(a["id"], "other")} for a in fixture]
    if not water:
        drafts = [a for a in drafts if a["id"] in ("A1", "A3")]
    return finalize_actions(drafts)


def timing_note(actions: list[dict], exposure_usd: float) -> str:
    now_ids = [a["id"] for a in actions if a["timing"] == "now" and a["quadrant"] == "quick_win"]
    later = [a["id"] for a in actions if a["timing"] == "next_shutdown"]
    parts = []
    if now_ids:
        span = f"{now_ids[0]} to {now_ids[-1]}" if len(now_ids) > 2 else " and ".join(now_ids)
        parts.append(f"{span} now with no downtime.")
    if later:
        parts.append(f"{', '.join(later)} at the next planned shutdown rather than run to failure "
                     f"(exposure US${exposure_usd / 1e6:.2f}M).")
    return " ".join(parts)


def _advise_live(matrix: dict, root_cause: Optional[dict]) -> list[dict]:
    sops = "\n\n".join(data.sop_full_texts().values())
    payload = {"matrix": matrix, "rootCause": root_cause}
    prompt = f"{PROMPT}\n\nSOP TEXTS:\n{sops}\n\nCASE:\n{json.dumps(payload)}"
    draft = generate_structured(prompt, AdvisorDraft)
    return [a.model_dump(mode="json") for a in draft.actions][:8]


def advise(matrix: dict, root_cause: Optional[dict], water: bool = True) -> tuple[list[dict], bool]:
    """Return (actions, cached flag)."""
    s = get_settings()
    if s.live:
        try:
            genai_client()
            drafts = call_with_timeout(_advise_live, matrix, root_cause, timeout=s.live_timeout_s)
            actions = finalize_actions(drafts)
            if actions:
                return actions, False
        except Exception as exc:
            log.warning("live advisor failed, cached fallback: %s", exc)
    return cached_actions(water), True
