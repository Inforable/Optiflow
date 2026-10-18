"""R-T5 pressure-path classifier (ENG-LOGIC, team research dossier).

Linear slopes over the window for PT-104, PDT-101, PT-106, IT-104A, LT-101 and TT-102:
- (down, up, flat) = filter loading
- (down, flat, down) = pump wear or relief valve passing
- level down = external leak
- level up plus confirmed haze = water ingress
- TT-102 up = hot oil or cooler
- transmitter vs local gauge mismatch, or a lone moving signal = instrument drift

Trend thresholds are SITE SETPOINTS (synthetic), not standards.
"""
from __future__ import annotations

from datetime import timedelta
from typing import Optional

import numpy as np

from ..services.data import parse_ts

RULE_ID = "R-T5"

# per-day slope thresholds (SITE SETPOINT, synthetic)
THRESH = {
    "PT-104": 0.015,   # barg/day
    "PDT-101": 0.03,   # bar/day
    "PT-106": 0.05,    # barg/day
    "LT-101": 0.2,     # %/day
    "TT-102": 0.5,     # degC/day
    "TE-201": 0.5,     # degC/day
    "IT-104A": 0.5,    # A/day
}
UNITS = {"PT-104": "barg", "PDT-101": "bar", "PT-106": "barg", "LT-101": "%", "TT-102": "degC",
         "TE-201": "degC", "IT-104A": "A"}
GAUGE_MISMATCH_BAR = 0.1

LABELS = {
    "filter_loading": "Filter loading",
    "pump_or_relief_valve": "Pump wear or relief valve passing",
    "external_leak": "External leak",
    "water_ingress": "Water ingress",
    "hot_oil_or_cooler": "Hot oil or cooler problem",
    "instrument_drift": "Instrument drift suspected",
    "normal": "Normal",
}


def slope_per_day(points: list) -> Optional[float]:
    if not points or len(points) < 3:
        return None
    t0 = parse_ts(points[0][0])
    x = np.array([(parse_ts(p[0]) - t0).total_seconds() / 86400.0 for p in points])
    y = np.array([float(p[1]) for p in points])
    if np.ptp(x) == 0:
        return None
    return float(np.polyfit(x, y, 1)[0])


def _window(series: dict[str, list], end_iso: Optional[str], days: float) -> dict[str, list]:
    ends = [parse_ts(pts[-1][0]) for pts in series.values() if pts]
    if not ends:
        return {}
    end = parse_ts(end_iso) if end_iso else max(ends)
    start = end - timedelta(days=days)
    return {t: [p for p in pts if start <= parse_ts(p[0]) <= end] for t, pts in series.items()}


def direction(tag: str, slope: Optional[float]) -> str:
    if slope is None:
        return "unknown"
    th = THRESH.get(tag, 0.0)
    if slope > th:
        return "up"
    if slope < -th:
        return "down"
    return "flat"


def classify(series: dict[str, list], end_iso: Optional[str] = None, days: float = 5.0,
             oil_haze: Optional[bool] = None, gauge_reading_barg: Optional[float] = None) -> dict:
    """Classify the pressure-path mechanism from hourly series {tag: [[iso, value], ...]}."""
    win = _window(series, end_iso, days)
    slopes = {t: slope_per_day(win.get(t, [])) for t in THRESH}
    dirs = {t: direction(t, s) for t, s in slopes.items()}
    lt = win.get("LT-101") or []
    level_delta = round(float(lt[-1][1]) - float(lt[0][1]), 1) if len(lt) >= 2 else 0.0
    pt = win.get("PT-104") or []
    last_pt = float(pt[-1][1]) if pt else None

    hdr, fdp, dis, lvl, oil_t = dirs["PT-104"], dirs["PDT-101"], dirs["PT-106"], dirs["LT-101"], dirs["TT-102"]

    if gauge_reading_barg is not None and last_pt is not None and abs(gauge_reading_barg - last_pt) > GAUGE_MISMATCH_BAR:
        mech = "instrument_drift"
    elif lvl == "down":
        mech = "external_leak"
    elif lvl == "up" and oil_haze:
        mech = "water_ingress"
    elif hdr == "down" and fdp == "up" and dis in ("flat", "up"):
        mech = "filter_loading"
    elif hdr == "down" and fdp == "flat" and dis == "down":
        mech = "pump_or_relief_valve"
    elif oil_t == "up":
        mech = "hot_oil_or_cooler"
    elif hdr == "down" and fdp == "flat" and dis == "flat" and lvl == "flat" and dirs["TE-201"] != "up":
        mech = "instrument_drift"
    else:
        mech = "normal"

    def part(tag: str) -> str:
        d = dirs[tag]
        if d in ("up", "down"):
            return f"{tag} {d} {abs(slopes[tag]):.2f} {UNITS[tag]}/day"
        return f"{tag} {d}"

    lvl_word = {"up": "rising", "down": "falling"}.get(lvl, "flat")
    evidence = f"{part('PT-104')}, {part('PDT-101')}, {part('PT-106')}; LT-101 {lvl_word} ({level_delta:+.1f}%)"
    if mech == "hot_oil_or_cooler":
        evidence += f"; {part('TT-102')}"
    if mech == "instrument_drift" and gauge_reading_barg is not None and last_pt is not None:
        evidence += f"; local gauge {gauge_reading_barg:.2f} barg vs PT-104 {last_pt:.2f} barg"
    return {
        "ruleId": RULE_ID,
        "mechanism": mech,
        "label": LABELS[mech],
        "evidence": evidence,
        "verdict": "G" if mech == "normal" else "NG",
        "slopes": {t: (round(s, 4) if s is not None else None) for t, s in slopes.items()},
        "directions": dirs,
        "levelDelta": level_delta,
    }


def to_model_fields(result: dict) -> dict:
    return {k: result[k] for k in ("ruleId", "mechanism", "label", "evidence")}
