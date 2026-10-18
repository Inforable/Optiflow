"""Ask LubeGuard: GraphRAG-lite over the plant knowledge graph and SOP sections.

Retrieval: knowledge-graph nodes mentioned in the question (ids or label keywords), plus the
case's root-cause path when the question is in scope, expanded to the 2-hop neighbourhood,
plus the text of linked SOP sections and incidents. Gemini answers only from that context;
citations are validated against the retrieved nodes. Empty retrieval means a refusal.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Optional

from pydantic import BaseModel, Field

from ..config import get_settings
from ..services import data
from .common import call_with_timeout, generate_structured, genai_client

log = logging.getLogger("lubeguard.ask")

REFUSAL = "0 sources, answer refused. I only answer from this plant's lube-oil knowledge graph and SOPs."

STOPWORDS = {
    "the", "and", "for", "with", "from", "into", "side", "test", "check", "plant", "normal", "values",
    "when", "what", "over", "after", "before", "change", "high", "low", "system", "main", "unit", "lube",
    "oil", "lube-oil", "point", "record", "start", "standby", "relay", "position", "active", "inactive",
}
DOMAIN_WORDS = {
    "filter": ["F-101A", "F1", "PDT-101"], "clog": ["F1", "F-101A"], "loading": ["F1", "F-101A", "R-T5"],
    "pressure": ["PT-104", "HEADER", "R-T5"], "header": ["HEADER", "PT-104"], "cooler": ["E-101A", "F5"],
    "water": ["F2", "WATER-PPM", "OIL"], "hazy": ["F2", "SOP-LO-04 §2"], "milky": ["F2", "SOP-LO-04 §2"],
    "bearing": ["BRG-1", "F12", "TE-201"], "wipe": ["F12"], "auto-start": ["F6", "R-T4", "P-104B"],
    "autostart": ["F6", "R-T4", "P-104B"], "pump": ["P-104A", "F3"], "vibration": ["VT-104A", "R-P1"],
    "purifier": ["SOP-LO-06 §3"], "sample": ["SOP-LO-04 §2"], "leak": ["F4", "E-101A"],
    "turbine": ["LO-01"], "lubricant": ["OIL"], "varnish": ["F7"], "foam": ["F11"], "motor": ["F9", "IT-104A"],
    "temperature": ["TE-201", "TT-102"], "level": ["LT-101"], "reservoir": ["TK-01", "LT-101"],
    "battery": ["BAT-220V"], "sop": ["LO-01"], "incident": ["LO-01"],
}


class AskDraft(BaseModel):
    answer: str
    citations: list[str] = Field(default_factory=list)
    refused: bool = False


def _graph(extra: Optional[dict] = None) -> dict:
    g = data.kg()
    if extra:
        g["nodes"] = g["nodes"] + extra.get("nodes", [])
        g["edges"] = g["edges"] + extra.get("edges", [])
    return g


def find_mentions(question: str, graph: dict) -> list[str]:
    q = question.lower()
    words = set(re.findall(r"[a-z0-9][a-z0-9\-]+", q))
    found: list[str] = []
    for n in graph["nodes"]:
        nid = n["id"].lower()
        if re.search(r"(?<![a-z0-9])" + re.escape(nid) + r"(?![a-z0-9.])", q):
            found.append(n["id"])
    for w in words:
        for key, ids in DOMAIN_WORDS.items():
            if w == key or (len(w) > 4 and w.startswith(key)):
                found.extend(ids)
    for n in graph["nodes"]:
        if n["type"] in ("incident", "sop"):
            continue
        label_words = {w for w in re.findall(r"[a-z][a-z\-]+", n["label"].lower())
                       if len(w) >= 5 and w not in STOPWORDS}
        if label_words & words:
            found.append(n["id"])
    ids = {n["id"] for n in graph["nodes"]}
    return list(dict.fromkeys(f for f in found if f in ids))


def retrieve(question: str, case: Optional[dict] = None, extra_graph: Optional[dict] = None) -> dict:
    g = _graph(extra_graph)
    seeds = find_mentions(question, g)
    if not seeds:
        return {"seeds": [], "nodes": [], "edges": [], "sections": {}, "context": ""}
    path = (((case or {}).get("diagnosis") or {}).get("rootCause") or {}).get("path") or []
    if not path and case:
        mech = (case.get("pressurePath") or {}).get("mechanism")
        path = ["F-101A", "HEADER", "BRG-1"] if mech == "filter_loading" else []
    start = list(dict.fromkeys(seeds + path))
    nb = data.neighbourhood(start, hops=2, graph=g, limit=45)
    secs = data.sop_sections()
    sections = {n["id"]: secs[n["id"]] for n in nb["nodes"] if n["id"] in secs}
    for sid in re.findall(r"SOP-LO-\d{2}\s*§\d+(?:\.\d+)?", question):
        nid = data.normalize_citation(sid)
        if nid in secs:
            sections[nid] = secs[nid]
    lines = []
    for n in nb["nodes"]:
        desc = n.get("props", {}).get("description")
        capa = n.get("props", {}).get("capa")
        line = f"[{n['id']}] ({n['type']}) {n['label']}"
        if desc:
            line += f": {desc}"
        if capa:
            line += f". CAPA: {capa}"
        lines.append(line)
    for e in nb["edges"]:
        lines.append(f"{e['source']} -{e['type']}-> {e['target']}")
    for sid, s in sections.items():
        lines.append(f"[{sid}] {s['title']}: {s['text']}")
    return {"seeds": seeds, "nodes": nb["nodes"], "edges": nb["edges"], "sections": sections,
            "context": "\n".join(lines)}


def _citation(cid: str, graph: dict) -> dict:
    for n in graph["nodes"]:
        if n["id"] == cid:
            return {"id": cid, "type": n["type"], "label": n["label"]}
    return data.citation_meta(cid)


def _normalise_q(q: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", q.lower()).strip()


def _cached_example(question: str) -> Optional[dict]:
    nq = _normalise_q(question)
    for ex in data.load_fixture("ask_examples"):
        if _normalise_q(ex["question"]) == nq:
            return ex["response"]
    return None


def _templated(ret: dict, graph: dict) -> dict:
    by_id = {n["id"]: n for n in ret["nodes"]}
    seeds = [s for s in ret["seeds"] if s in by_id][:3]
    facts: list[str] = []
    cited: list[str] = []
    rel_text = {"CAN_FAIL_AS": "can fail as", "DETECTED_BY": "is detected by", "MITIGATED_BY": "is handled by",
                "MEASURED_BY": "is measured by", "FEEDS": "feeds", "HAD_MODE": "was an instance of",
                "HAS_PART": "includes", "FLOWS_THROUGH": "flows through", "STARTS": "starts", "POWERS": "powers",
                "SENSES": "senses", "TRIGGERS": "triggers", "ENERGIZES": "energizes", "DRAINS_TO": "drains to",
                "HOLDS": "holds", "EXCHANGES_HEAT_WITH": "exchanges heat with"}
    for s in seeds:
        for e in ret["edges"]:
            if s in (e["source"], e["target"]) and len(facts) < 4:
                if "LO-01" in (e["source"], e["target"]):
                    continue
                a, b = by_id.get(e["source"]), by_id.get(e["target"])
                if not a or not b:
                    continue
                facts.append(f"{a['label']} {rel_text.get(e['type'], e['type'].lower())} {b['label']}")
                cited += [a["id"], b["id"]]
    cited = list(dict.fromkeys(cited))[:5]
    sec_ids = [sid for sid in ret["sections"]][:2]
    for sid in sec_ids:
        sec = ret["sections"][sid]
        first = next((ln for ln in sec["text"].splitlines() if ln.strip()), "")[:160]
        facts.append(f"{sid} ({sec['title']}): {first.rstrip('.')}")
        cited.append(sid)
    if not facts:
        return {"answer": REFUSAL, "citations": [], "refused": True}
    cited = list(dict.fromkeys(cited))[:7]
    answer = "From this plant's knowledge graph and SOPs: " + "; ".join(facts) + "."
    return {"answer": answer, "citations": [_citation(c, graph) for c in cited], "refused": False}


def _answer_live(question: str, ret: dict) -> dict:
    prompt = ("Answer the question using ONLY the CONTEXT (this plant's lube-oil knowledge graph and SOP sections, "
              "synthetic demo data). Cite node ids in square brackets from the CONTEXT in `citations` "
              "(ids only, for example 'F-101A' or 'SOP-LO-04 §2'). If the CONTEXT does not answer the question "
              f"or it is out of scope, set refused true and answer exactly: {REFUSAL}\n"
              f"Keep the answer under 120 words, plain English.\n\nCONTEXT:\n{ret['context'][:40000]}\n\n"
              f"QUESTION: {question}")
    return generate_structured(prompt, AskDraft).model_dump(mode="json")


def ask(question: str, case: Optional[dict] = None, extra_graph: Optional[dict] = None) -> tuple[dict, bool]:
    """Return (AskResponse dict, cached flag)."""
    q = (question or "").strip()
    if not q:
        return {"answer": REFUSAL, "citations": [], "refused": True}, False
    g = _graph(extra_graph)
    ret = retrieve(q, case, extra_graph)
    if not ret["nodes"]:
        return {"answer": REFUSAL, "citations": [], "refused": True}, False
    allowed = {n["id"] for n in ret["nodes"]} | set(ret["sections"].keys())
    s = get_settings()
    if s.live:
        try:
            genai_client()
            draft = call_with_timeout(_answer_live, q, ret, timeout=s.live_timeout_s)
            if draft.get("refused"):
                return {"answer": REFUSAL, "citations": [], "refused": True}, False
            cites = [data.normalize_citation(c.strip("[] ")) for c in draft.get("citations") or []]
            cites = list(dict.fromkeys(c for c in cites if c in allowed))
            if cites:
                return {"answer": draft["answer"], "citations": [_citation(c, g) for c in cites],
                        "refused": False}, False
            log.info("live answer had no valid citations; using grounded template")
        except Exception as exc:
            log.warning("live ask failed, cached fallback: %s", exc)
    ex = _cached_example(q)
    if ex is not None:
        return ex, True
    return _templated(ret, g), True
