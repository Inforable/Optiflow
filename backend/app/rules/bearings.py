"""R-T3 bearing temperature (Turbomachinery Magazine [NR-013]).

Practical tilting-pad babbitt limit about 129 degC; oxidation rate roughly doubles every
10 degC above 60 degC bulk oil. Alarm 115 and trip 125 degC are SITE SETPOINTS.
"""
from __future__ import annotations

from typing import Optional

RULE_ID = "R-T3"
BABBITT_LIMIT_C = 129.0
ALARM_C = 115.0
TRIP_C = 125.0
RISING_C_PER_DAY = 2.0


def oxidation_factor(bulk_oil_c: float) -> float:
    """Relative oxidation rate vs 60 degC (doubles per 10 degC)."""
    return round(2 ** ((bulk_oil_c - 60.0) / 10.0), 2) if bulk_oil_c > 60 else 1.0


def check(temp_c: float, slope_c_per_day: Optional[float] = None, bulk_oil_c: Optional[float] = None,
          alarm_c: float = ALARM_C, trip_c: float = TRIP_C) -> dict:
    margin_alarm = round(alarm_c - temp_c, 1)
    margin_babbitt = round(BABBITT_LIMIT_C - temp_c, 1)
    if temp_c >= trip_c:
        verdict, label = "NG", f"Bearing {temp_c:.0f} degC at or above trip {trip_c:.0f} degC"
    elif temp_c >= alarm_c:
        verdict, label = "NG", f"Bearing {temp_c:.0f} degC above alarm {alarm_c:.0f} degC"
    elif slope_c_per_day is not None and slope_c_per_day >= RISING_C_PER_DAY:
        days = margin_alarm / slope_c_per_day if slope_c_per_day > 0 else None
        verdict = "UNVERIFIED"
        label = f"Bearing {temp_c:.0f} degC rising {slope_c_per_day:.1f} degC/day; about {days:.0f} days to alarm"
    else:
        verdict, label = "G", f"Bearing {temp_c:.0f} degC, {margin_alarm:.0f} degC below alarm"
    evidence = f"{temp_c:.1f} degC; {margin_babbitt:.0f} degC below the about 129 degC babbitt limit [NR-013]"
    if bulk_oil_c is not None:
        evidence += f"; oxidation rate x{oxidation_factor(bulk_oil_c)} vs 60 degC"
    return {"ruleId": RULE_ID, "verdict": verdict, "label": label, "evidence": evidence,
            "marginToAlarmC": margin_alarm, "marginToBabbittC": margin_babbitt}
