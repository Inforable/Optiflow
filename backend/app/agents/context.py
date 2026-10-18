"""Deterministic rule results for a case (numbers by code, never by the model)."""
from __future__ import annotations

from typing import Any

from ..rules import autostart, bearings, loss, oil_limits, pressure_path, pump_motor
from ..services import data


def _last(series: dict, tag: str) -> float | None:
    pts = series.get(tag) or []
    return float(pts[-1][1]) if pts else None


def pre_repair_series(case: dict) -> dict[str, list]:
    series = case.get("readings", {}).get("series", {})
    post = case.get("readings", {}).get("postRepairFrom")
    if not post:
        return series
    cut = data.parse_ts(post)
    return {t: [p for p in pts if data.parse_ts(p[0]) <= cut] for t, pts in series.items()}


def rule_results(case: dict, oil_haze: bool | None = None) -> dict[str, Any]:
    series = pre_repair_series(case)
    sp = data.setpoints()
    ref_date = case.get("openedAt", data.CASE_AT)
    end_iso = series.get("PT-104", [[ref_date]])[-1][0] if series.get("PT-104") else None

    pp = pressure_path.classify(series, end_iso=end_iso, oil_haze=oil_haze)
    last_pt = _last(series, "PT-104") or sp["PT-104"]["normal"]
    auto = autostart.check(last_pt, data.autostart_tests(), ref_date,
                           psl_barg=sp["PT-104"]["low"], interval_days=sp.get("autostartTestIntervalDays", 30))
    impact = loss.exposure(data.incidents())

    vib = _last(series, "VT-104A") or sp["VT-104A"]["normal"]
    cur = _last(series, "IT-104A") or sp["IT-104A"]["normal"]
    pump = pump_motor.pump_health(vib, cur, sp["IT-104A"]["fla"], sp["IT-104A"]["serviceFactor"],
                                  pp["slopes"].get("VT-104A") if "VT-104A" in pp["slopes"] else None)

    samples = sorted(data.oil_lab(), key=lambda s: s["sampleDate"], reverse=True)
    lab = samples[0] if samples else {}
    lab_res = oil_limits.check_oil(lab) if lab else {"ruleId": "R-T1", "verdict": "UNVERIFIED",
                                                      "label": "No lab sample", "evidence": ""}
    lab_age = (data.parse_ts(ref_date).date() - data.parse_ts(lab["sampleDate"] + "T00:00:00+07:00").date()).days if lab else None

    te = _last(series, "TE-201") or sp["TE-201"]["normal"]
    brg = bearings.check(te, pp["slopes"].get("TE-201"), bulk_oil_c=_last(series, "TT-102"))
    return {"pressurePath": pp, "autostart": auto, "impact": impact, "pump": pump,
            "lab": {"sample": lab, "result": lab_res, "ageDays": lab_age}, "bearing": brg}


def signals_summary(case: dict, days: int = 6) -> dict:
    series = pre_repair_series(case)
    out = {}
    for tag, pts in series.items():
        win = data.case_series_window({tag: pts}, end_iso=pts[-1][0], days=days)[tag] if pts else []
        if not win:
            continue
        vals = [float(p[1]) for p in win]
        out[tag] = {"first": vals[0], "last": vals[-1], "min": min(vals), "max": max(vals),
                    "slopePerDay": round(pressure_path.slope_per_day(win) or 0.0, 4), "points": len(win)}
    return out
