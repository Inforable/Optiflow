"""Cached loaders for the synthetic plant data, SOPs, fixtures and citation ids.

All plant data in backend/data is synthetic and labelled as such.
"""
from __future__ import annotations

import copy
import json
import os
import re
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, Optional

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.dirname(APP_DIR)
ROOT_DIR = os.path.dirname(BACKEND_DIR)
DATA_DIR = os.path.join(BACKEND_DIR, "data")
GEN_DIR = os.path.join(DATA_DIR, "generated")
SOP_DIR = os.path.join(DATA_DIR, "sops")
SAMPLES_DIR = os.path.join(DATA_DIR, "samples")


def fixtures_dir() -> str:
    env = os.environ.get("FIXTURES_DIR")
    if env and os.path.isdir(env):
        return env
    for cand in (os.path.join(ROOT_DIR, "fixtures"), "/app/fixtures"):
        if os.path.isdir(cand):
            return cand
    return os.path.join(ROOT_DIR, "fixtures")


WIB = timezone(timedelta(hours=7))
CASE_AT = "2026-10-18T02:00:00+07:00"
ONSET_AT = "2026-10-13T02:00:00+07:00"
COST_PER_HOUR_USD = 29721

RULE_IDS = ["R-T1", "R-T2", "R-T3", "R-T4", "R-T5", "R-P1", "R-P8", "R4", "R5"]
RULE_LABELS = {
    "R-T1": "R-T1 Turbine oil limits",
    "R-T2": "R-T2 ISO 4406 cleanliness code",
    "R-T3": "R-T3 Bearing temperature",
    "R-T4": "R-T4 Auto-start readiness",
    "R-T5": "R-T5 Pressure-path classifier",
    "R-P1": "R-P1 Pump vibration (ISO 10816-7)",
    "R-P8": "R-P8 Motor overheating logic",
    "R4": "R4 Voltage unbalance",
    "R5": "R5 Insulation life",
}

# Synthetic maintenance context per component (fictional plant)
ASSET_CONTEXT: dict[str, dict[str, Any]] = {
    "F-101A": {"elementInServiceDays": 41, "lastChange": "2026-09-07", "note": "Element rated 10 um beta 200"},
    "F-101B": {"elementInServiceDays": 0, "lastChange": "2026-09-07", "note": "Clean standby element installed"},
    "P-104A": {"lastServiceDays": 63, "ratedKw": 30, "flaA": 70, "serviceFactor": 1.15},
    "P-104B": {"lastServiceDays": 120, "ratedKw": 30},
    "P-105": {"lastServiceDays": 200, "dcVolts": 220},
    "E-101A": {"inServiceSinceDays": 410, "lastTubeTest": "2025-04-12", "note": "Cooling-water side at 3.0 barg"},
    "E-101B": {"inServiceSinceDays": 0, "note": "Standby cooler, clean"},
    "TK-01": {"capacityL": 6000, "note": "Reservoir with drain sample point"},
    "HEADER": {"normalBarg": 1.6},
    "BRG-1": {"normalDegC": 88, "alarmDegC": 115, "tripDegC": 125},
}


def now_iso() -> str:
    return datetime.now(WIB).replace(microsecond=0).isoformat()


def iso_plus(minutes: int) -> str:
    return (datetime.now(WIB) + timedelta(minutes=minutes)).replace(microsecond=0).isoformat()


def parse_ts(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _load_json(path: str) -> Any:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=None)
def _cached(path: str) -> Any:
    return _load_json(path)


def load_data(name: str) -> Any:
    """Load backend/data/<name>.json (deep copy, callers may mutate)."""
    return copy.deepcopy(_cached(os.path.join(DATA_DIR, f"{name}.json")))


def load_generated(name: str) -> Any:
    return copy.deepcopy(_cached(os.path.join(GEN_DIR, f"{name}.json")))


def load_fixture(name: str) -> Any:
    return copy.deepcopy(_cached(os.path.join(fixtures_dir(), f"{name}.json")))


def setpoints() -> dict:
    return load_data("setpoints")


def incidents() -> list[dict]:
    return load_data("incidents")["incidents"]


def failure_modes() -> dict[str, str]:
    return load_data("incidents")["failureModes"]


def kg() -> dict:
    return load_data("kg")


def raci() -> dict:
    return load_data("raci")


def authority() -> dict:
    return load_data("authority")["actions"]


def oil_lab() -> list[dict]:
    return load_data("oil_lab")["samples"]


def autostart_tests() -> list[dict]:
    return load_data("autostart_tests")["tests"]


def hourly(scenario: str = "hero") -> dict:
    return load_generated(f"hourly_{scenario}")


def anomalies(scenario: str = "hero") -> dict:
    return load_generated(f"anomalies_{scenario}")


# ---------------------------------------------------------------- SOP parsing
_H2 = re.compile(r"^##\s+§(\d+)\s+(.*)$")
_H3 = re.compile(r"^###\s+§(\d+\.\d+)\s+(.*)$")


@lru_cache(maxsize=1)
def _sop_sections() -> dict[str, dict]:
    sections: dict[str, dict] = {}
    if not os.path.isdir(SOP_DIR):
        return sections
    for fn in sorted(os.listdir(SOP_DIR)):
        if not fn.endswith(".md"):
            continue
        sop_id = fn[:-3]
        with open(os.path.join(SOP_DIR, fn), encoding="utf-8") as f:
            lines = f.read().splitlines()
        title = lines[0].lstrip("# ").strip() if lines else sop_id
        cur_h2: Optional[str] = None
        cur_h3: Optional[str] = None
        for line in lines[1:]:
            m2 = _H2.match(line)
            m3 = _H3.match(line)
            if m2:
                cur_h2 = f"{sop_id} §{m2.group(1)}"
                cur_h3 = None
                sections[cur_h2] = {"id": cur_h2, "sop": sop_id, "sopTitle": title,
                                    "title": m2.group(2).strip(), "text": ""}
                continue
            if m3:
                cur_h3 = f"{sop_id} §{m3.group(1)}"
                sections[cur_h3] = {"id": cur_h3, "sop": sop_id, "sopTitle": title,
                                    "title": m3.group(2).strip(), "text": ""}
                if cur_h2:
                    sections[cur_h2]["text"] += f"{m3.group(1)} {m3.group(2).strip()}\n"
                continue
            if cur_h3:
                sections[cur_h3]["text"] += line + "\n"
            if cur_h2:
                sections[cur_h2]["text"] += line + "\n"
    for s in sections.values():
        s["text"] = s["text"].strip()
    return sections


def sop_sections() -> dict[str, dict]:
    return copy.deepcopy(_sop_sections())


def sop_section_ids() -> set[str]:
    return set(_sop_sections().keys())


@lru_cache(maxsize=1)
def sop_full_texts() -> dict[str, str]:
    out: dict[str, str] = {}
    if not os.path.isdir(SOP_DIR):
        return out
    for fn in sorted(os.listdir(SOP_DIR)):
        if fn.endswith(".md"):
            with open(os.path.join(SOP_DIR, fn), encoding="utf-8") as f:
                out[fn[:-3]] = f.read()
    return out


_SOP_REF = re.compile(r"(SOP-LO-\d{2})\s*(?:§|section|sec\.?|s\.?|#)?\s*(\d+(?:\.\d+)?)", re.IGNORECASE)


def normalize_citation(cid: str) -> str:
    """Normalise model-written citations: 'SOP-LO-04 section 2' -> 'SOP-LO-04 §2', 'evidence:EV-1' -> 'EV-1'."""
    c = (cid or "").strip()
    if c.lower().startswith("evidence:"):
        c = c.split(":", 1)[1].strip()
    m = _SOP_REF.fullmatch(c) or _SOP_REF.match(c)
    if m and c.upper().startswith("SOP-LO"):
        return f"{m.group(1).upper()} §{m.group(2)}"
    return c


@lru_cache(maxsize=1)
def _static_citation_ids() -> frozenset[str]:
    ids = set(RULE_IDS)
    ids |= set(_sop_sections().keys())
    ids |= {i["id"] for i in _cached(os.path.join(DATA_DIR, "incidents.json"))["incidents"]}
    ids |= {n["id"] for n in _cached(os.path.join(DATA_DIR, "kg.json"))["nodes"]}
    return frozenset(ids)


def valid_citation_ids(evidence_ids: Optional[list[str]] = None) -> set[str]:
    ids = set(_static_citation_ids())
    ids |= set(evidence_ids or [])
    return ids


def citation_meta(cid: str) -> dict:
    """Return {id, type, label} for a citation id (for Ask responses)."""
    for n in _cached(os.path.join(DATA_DIR, "kg.json"))["nodes"]:
        if n["id"] == cid:
            return {"id": cid, "type": n["type"], "label": n["label"]}
    secs = _sop_sections()
    if cid in secs:
        return {"id": cid, "type": "sop", "label": f"{cid} {secs[cid]['title']}"}
    if cid in RULE_LABELS:
        return {"id": cid, "type": "rule", "label": RULE_LABELS[cid]}
    return {"id": cid, "type": "node", "label": cid}


# ---------------------------------------------------------------- graph helpers
def neighbourhood(node_ids: list[str], hops: int = 2, graph: Optional[dict] = None,
                  skip_hubs: tuple[str, ...] = ("LO-01",), limit: int = 60) -> dict:
    """Undirected k-hop neighbourhood. Hub nodes are included but not expanded."""
    g = graph or kg()
    by_id = {n["id"]: n for n in g["nodes"]}
    adj: dict[str, list[tuple[str, dict]]] = {}
    for e in g["edges"]:
        adj.setdefault(e["source"], []).append((e["target"], e))
        adj.setdefault(e["target"], []).append((e["source"], e))
    seen: dict[str, int] = {}
    frontier = [n for n in node_ids if n in by_id]
    for n in frontier:
        seen[n] = 0
    for hop in range(1, hops + 1):
        nxt = []
        for n in frontier:
            if n in skip_hubs and n not in node_ids:
                continue
            for m, _e in adj.get(n, []):
                if m not in seen:
                    seen[m] = hop
                    nxt.append(m)
        frontier = nxt
    ordered = sorted(seen.items(), key=lambda kv: kv[1])[:limit]
    keep = {k for k, _ in ordered}
    nodes = [dict(by_id[k], hop=h) for k, h in ordered]
    edges = [e for e in g["edges"] if e["source"] in keep and e["target"] in keep]
    return {"nodes": nodes, "edges": edges}


def case_series_window(series: dict[str, list], end_iso: str = CASE_AT, days: float = 5.0) -> dict[str, list]:
    end = parse_ts(end_iso)
    start = end - timedelta(days=days)
    return {t: [p for p in pts if start <= parse_ts(p[0]) <= end] for t, pts in series.items()}
