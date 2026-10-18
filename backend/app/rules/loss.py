"""Loss and exposure: median downtime of similar bearing-wipe incidents x US$29,721/h.

US$29,721 per downtime hour comes from the problem brief (US$67.2M / 2,261 h).
Incidents are synthetic.
"""
from __future__ import annotations

import statistics

COST_PER_HOUR_USD = 29721
# Bearing-wipe incidents caused by oil-supply problems are "similar" to a header decay case
OIL_SUPPLY_KEYWORDS = ("pressure", "starvation", "standby pump", "oil supply")


def similar_bearing_wipes(incidents: list[dict]) -> list[dict]:
    out = []
    for inc in incidents:
        if inc.get("failureMode") != "F12":
            continue
        text = (inc.get("description", "") + " " + inc.get("rootCause4m1e", "")).lower()
        if any(k in text for k in OIL_SUPPLY_KEYWORDS):
            out.append(inc)
    return out


def exposure(incidents: list[dict], cost_per_hour: int = COST_PER_HOUR_USD, loss_per_min_usd: float = 0.0) -> dict:
    similar = similar_bearing_wipes(incidents)
    if not similar:
        return {"lossPerMinUsd": loss_per_min_usd, "exposureUsd": 0.0,
                "formula": "No similar bearing-wipe incidents found", "assumptions": [], "incidentIds": []}
    hours = [float(i["downtimeH"]) for i in similar]
    med = statistics.median(hours)
    parts = ", ".join(f"{i['id']} ({float(i['downtimeH']):.0f} h)" for i in similar)
    return {
        "lossPerMinUsd": loss_per_min_usd,
        "exposureUsd": round(med * cost_per_hour),
        "formula": (f"{med:.0f} h median downtime of similar bearing-wipe incidents x US$29,721/h "
                    f"(problem brief: US$67.2M / 2,261 h)"),
        "assumptions": [f"Median of {parts}; synthetic incidents",
                        "No production loss yet: turbine still at full load"],
        "incidentIds": [i["id"] for i in similar],
        "medianHours": med,
    }


def to_model_fields(result: dict) -> dict:
    return {k: result[k] for k in ("lossPerMinUsd", "exposureUsd", "formula", "assumptions")}
