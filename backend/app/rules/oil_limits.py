"""R-T1 turbine oil limits and R-T2 ISO 4406 code lookup.

Source: ASTM D4378 as tabulated by ExxonMobil [NR-012] (see docs/SOURCES.md).
The 500 ppm water action limit is a SITE SETPOINT (synthetic); the 0.1% (1,000 ppm)
limit for steam turbines is from [NR-012].
"""
from __future__ import annotations

from typing import Optional

RULE_T1 = "R-T1"
RULE_T2 = "R-T2"

WATER_LIMIT_PPM = 1000      # 0.1% for steam turbines [NR-012]
WATER_SITE_ACTION_PPM = 500  # SITE SETPOINT (synthetic)
VISCOSITY_LIMIT_PCT = 5.0
TAN_CAUTION = 0.1
TAN_WARNING = 0.3
RPVOT_LIMIT_PCT = 25.0
FOAM_LIMIT_ML = 450
ISO_TARGET = "18/16/13"

# ISO 4406 table: code -> (more than, up to) particles per ml
ISO4406_TABLE: dict[int, tuple[float, float]] = {
    1: (0.01, 0.02), 2: (0.02, 0.04), 3: (0.04, 0.08), 4: (0.08, 0.16), 5: (0.16, 0.32),
    6: (0.32, 0.64), 7: (0.64, 1.3), 8: (1.3, 2.5), 9: (2.5, 5), 10: (5, 10), 11: (10, 20),
    12: (20, 40), 13: (40, 80), 14: (80, 160), 15: (160, 320), 16: (320, 640), 17: (640, 1300),
    18: (1300, 2500), 19: (2500, 5000), 20: (5000, 10000), 21: (10000, 20000),
    22: (20000, 40000), 23: (40000, 80000), 24: (80000, 160000), 25: (160000, 320000),
    26: (320000, 640000), 27: (640000, 1300000), 28: (1300000, 2500000),
}


def iso4406_code_for_count(count_per_ml: float) -> int:
    """Scale number for a particle count per ml (R-T2)."""
    if count_per_ml <= 0.01:
        return 0
    for code, (lo, hi) in ISO4406_TABLE.items():
        if lo < count_per_ml <= hi:
            return code
    return 28 if count_per_ml > 2500000 else 0


def iso4406_code(c4: float, c6: float, c14: float) -> str:
    return f"{iso4406_code_for_count(c4)}/{iso4406_code_for_count(c6)}/{iso4406_code_for_count(c14)}"


def parse_iso(code: str) -> tuple[int, int, int]:
    a, b, c = (int(x) for x in code.split("/"))
    return a, b, c


def check_iso4406(code: str, target: str = ISO_TARGET) -> dict:
    got, tgt = parse_iso(code), parse_iso(target)
    ok = all(g <= t for g, t in zip(got, tgt))
    return {
        "ruleId": RULE_T2,
        "verdict": "G" if ok else "NG",
        "label": f"ISO 4406 {code} {'meets' if ok else 'worse than'} target {target}",
        "evidence": f"ISO 4406 {code} vs target {target} or better [NR-012]",
    }


def check_water(water_ppm: float) -> dict:
    if water_ppm > WATER_LIMIT_PPM:
        verdict, label = "NG", f"Water {water_ppm:.0f} ppm above 0.1% (1,000 ppm) steam-turbine limit"
    elif water_ppm > WATER_SITE_ACTION_PPM:
        verdict, label = "NG", f"Water {water_ppm:.0f} ppm above site action limit 500 ppm (SITE SETPOINT)"
    else:
        verdict, label = "G", f"Water {water_ppm:.0f} ppm below site action limit 500 ppm"
    return {"ruleId": RULE_T1, "verdict": verdict, "label": label,
            "evidence": f"Karl Fischer water {water_ppm:.0f} ppm; limit 1,000 ppm [NR-012], site action 500 ppm"}


def check_oil(sample: dict) -> dict:
    """Evaluate one lab sample against R-T1 (and R-T2 for the ISO code)."""
    findings: list[str] = []
    worst = "G"

    def flag(v: str, text: str) -> None:
        nonlocal worst
        findings.append(text)
        if v == "NG":
            worst = "NG"
        elif v == "UNVERIFIED" and worst == "G":
            worst = "UNVERIFIED"

    water = sample.get("waterPpm")
    if water is not None:
        w = check_water(float(water))
        if w["verdict"] != "G":
            flag("NG", w["label"])
    visc = sample.get("viscosityChangePct")
    if visc is not None and abs(float(visc)) > VISCOSITY_LIMIT_PCT:
        flag("NG", f"Viscosity change {visc}% outside +/-5% of new")
    tan = sample.get("tanOverNew")
    if tan is not None:
        if float(tan) >= TAN_WARNING:
            flag("NG", f"TAN {tan} mg KOH/g over new: warning (0.3 to 0.4)")
        elif float(tan) >= TAN_CAUTION:
            flag("UNVERIFIED", f"TAN {tan} mg KOH/g over new: caution (0.1 to 0.2)")
    rpvot = sample.get("rpvotPctNew")
    if rpvot is not None and float(rpvot) <= RPVOT_LIMIT_PCT:
        flag("NG", f"RPVOT {rpvot}% of new at or below 25%")
    foam = sample.get("foam")
    if foam:
        try:
            tendency = float(str(foam).split("/")[0])
            if tendency > FOAM_LIMIT_ML:
                flag("NG", f"Foam {foam} ml above 450 ml")
        except ValueError:
            pass
    iso = sample.get("iso4406")
    iso_result: Optional[dict] = None
    if iso:
        iso_result = check_iso4406(iso)
        if iso_result["verdict"] != "G":
            flag("NG", iso_result["label"])

    parts = []
    if water is not None:
        parts.append(f"{float(water):.0f} ppm water")
    if iso:
        parts.append(f"ISO {iso}")
    summary = ", ".join(parts)
    label = "Oil within limits" if worst == "G" else "; ".join(findings)
    return {
        "ruleId": RULE_T1,
        "verdict": worst,
        "label": label,
        "evidence": f"Lab sample {sample.get('sampleDate', '')}: {summary}".strip(),
        "findings": findings,
        "iso": iso_result,
    }
