"""Pump and motor rules.

R-P1: ISO 10816-7 Category I, pumps up to 200 kW (Europump [NR-024]): zone A up to 2.5,
B up to 4.0, C up to 6.6 mm/s RMS, D above.
R-P8: motor current vs FLA x service factor, plus the load vs cooling vs supply logic.
R4: voltage unbalance %VU = 100 x max deviation / average; above 2% unacceptable (NEMA MG-1 via [NE-004]).
"""
from __future__ import annotations

from typing import Optional

ZONE_A = 2.5
ZONE_B = 4.0
ZONE_C = 6.6


def vibration_zone(mm_s: float) -> str:
    if mm_s <= ZONE_A:
        return "A"
    if mm_s <= ZONE_B:
        return "B"
    if mm_s <= ZONE_C:
        return "C"
    return "D"


def check_vibration(mm_s: float, slope_per_day: Optional[float] = None) -> dict:
    zone = vibration_zone(mm_s)
    verdict = "G" if zone in ("A", "B") else "NG"
    text = {"A": "newly commissioned condition", "B": "acceptable for long-term operation",
            "C": "unsatisfactory, plan action", "D": "damage likely, act now"}[zone]
    label = f"{mm_s:.1f} mm/s RMS zone {zone} ({text})"
    if slope_per_day is not None and slope_per_day > 0.1 and zone != "A":
        label += f"; rising {slope_per_day:.2f} mm/s/day"
    return {"ruleId": "R-P1", "verdict": verdict, "label": label, "zone": zone,
            "evidence": f"VT-104A {mm_s:.2f} mm/s vs ISO 10816-7 Cat I zones A 2.5 / B 4.0 / C 6.6 [NR-024]"}


def check_current(current_a: float, fla_a: float, service_factor: float = 1.0) -> dict:
    limit = round(fla_a * service_factor, 1)
    load_pct = round(100.0 * current_a / fla_a, 0)
    verdict = "NG" if current_a > limit else "G"
    label = (f"{current_a:.0f} A above FLA x SF {limit} A" if verdict == "NG"
             else f"{current_a:.0f} A of {fla_a:.0f} A FLA ({load_pct:.0f}%)")
    return {"ruleId": "R-P8", "verdict": verdict, "label": label, "limitA": limit,
            "evidence": f"IT-104A {current_a:.1f} A vs FLA {fla_a} A x SF {service_factor} = {limit} A"}


def overheating_cause(current_trend: str, temp_trend: str, flow_trend: str = "flat",
                      vu_pct: float = 0.0, current_unbalance_pct: float = 0.0) -> dict:
    """R-P8 / R7 debate: hydraulic load vs cooling vs mechanical drag vs supply."""
    if vu_pct > 1.0 or current_unbalance_pct > 6.0:
        cause = "supply"
        label = "Supply problem: voltage or current unbalance"
    elif current_trend == "up" and flow_trend == "up":
        cause = "hydraulic_load"
        label = "Current rises with flow: hydraulic load"
    elif current_trend == "up":
        cause = "mechanical_drag"
        label = "Current up at constant flow and head: mechanical drag"
    elif temp_trend == "up":
        cause = "cooling"
        label = "Temperature up at baseline current: cooling problem"
    else:
        cause = "none"
        label = "No overheating signature"
    return {"ruleId": "R-P8", "cause": cause, "label": label,
            "verdict": "G" if cause == "none" else "NG", "evidence": label}


def voltage_unbalance(v1: float, v2: float, v3: float) -> dict:
    avg = (v1 + v2 + v3) / 3.0
    dev = max(abs(v - avg) for v in (v1, v2, v3))
    vu = round(100.0 * dev / avg, 2) if avg else 0.0
    if vu > 2.0:
        verdict, label = "NG", f"%VU {vu}% above 2% (unacceptable)"
    elif vu > 1.0:
        verdict, label = "UNVERIFIED", f"%VU {vu}% above 1%: derate and investigate supply"
    else:
        verdict, label = "G", f"%VU {vu}% within 1%"
    return {"ruleId": "R4", "verdict": verdict, "label": label, "vuPct": vu,
            "evidence": f"Phase voltages {v1}/{v2}/{v3} V; %VU = 100 x {dev:.1f} / {avg:.1f}"}


def pump_health(vib_mm_s: float, current_a: float, fla_a: float, service_factor: float,
                vib_slope: Optional[float] = None) -> dict:
    v = check_vibration(vib_mm_s, vib_slope)
    c = check_current(current_a, fla_a, service_factor)
    verdict = "NG" if "NG" in (v["verdict"], c["verdict"]) else "G"
    label = f"P-104A {vib_mm_s:.1f} mm/s (zone {v['zone']}), {current_a:.0f} A of {fla_a:.0f} A FLA: " + (
        "pump healthy" if verdict == "G" else "pump needs attention")
    return {"ruleId": "R-P1", "verdict": verdict, "label": label, "vibration": v, "current": c,
            "evidence": f"{v['evidence']}; {c['evidence']}"}
