"""R-T4 standby and DC pump auto-start readiness (API 614 logic via [NR-014]).

The standby pump must start on low header pressure. Flag when PT-104 crossed PSL-104
with no start event, or when the auto-start test is older than the SOP interval.
PSL-104 = 1.2 barg and the 30-day interval are SITE SETPOINTS (synthetic).
"""
from __future__ import annotations

from datetime import date
from typing import Optional

RULE_ID = "R-T4"
PSL_BARG = 1.2
SOP_INTERVAL_DAYS = 30


def _as_date(value) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def check(last_pt104_barg: float, tests: list[dict], ref_date, psl_barg: float = PSL_BARG,
          interval_days: int = SOP_INTERVAL_DAYS, crossed_without_start: bool = False) -> dict:
    """Return margin to PSL, last test age and verdict."""
    ref = _as_date(ref_date)
    margin = round(float(last_pt104_barg) - psl_barg, 2)
    passed = [t for t in tests if str(t.get("result", "pass")).lower() == "pass"]
    last: Optional[date] = max((_as_date(t["testDate"]) for t in passed), default=None)
    age = (ref - last).days if last else 9999
    overdue = age > interval_days

    if crossed_without_start or margin < 0:
        verdict = "NG"
        label = f"Header below PSL-104 without standby start; margin {margin:.1f} bar"
    elif overdue:
        verdict = "NG"
        label = f"Auto-start test overdue; {margin:.1f} bar margin to standby start"
    else:
        verdict = "G"
        label = f"Auto-start tested {age} days ago; {margin:.1f} bar margin to standby start"
    return {
        "ruleId": RULE_ID,
        "marginToPslBar": margin,
        "lastTestDays": int(age),
        "sopIntervalDays": int(interval_days),
        "verdict": verdict,
        "label": label,
        "evidence": (f"Last P-104B/P-105 auto-start test {age} days ago vs {interval_days}-day SOP interval; "
                     f"PT-104 {last_pt104_barg:.2f} barg vs PSL-104 {psl_barg} barg"),
    }


def to_model_fields(result: dict) -> dict:
    return {k: result[k] for k in ("ruleId", "marginToPslBar", "lastTestDays", "sopIntervalDays", "verdict", "label")}
