"""Verification: post-repair readings back inside baseline bands (SITE SETPOINTS, synthetic).

PT-104 1.6 +/- 0.05 barg, PDT-101 0.3 +/- 0.05 bar, TE-201 88 +/- 2 degC, judged on the
last reading of the post-repair series.
"""
from __future__ import annotations

from typing import Optional

from ..services.data import parse_ts

BASELINES: list[tuple[str, float, float]] = [
    ("PT-104", 1.6, 0.05),
    ("PDT-101", 0.3, 0.05),
    ("TE-201", 88.0, 2.0),
]


def post_repair(series: dict[str, list], post_from: Optional[str]) -> dict[str, list]:
    if not post_from:
        return series
    start = parse_ts(post_from)
    return {t: [p for p in pts if parse_ts(p[0]) > start] for t, pts in series.items()}


def check(series: dict[str, list], post_from: Optional[str] = None,
          baselines: list[tuple[str, float, float]] = BASELINES) -> dict:
    seg = post_repair(series, post_from)
    checks = []
    for tag, base, band in baselines:
        pts = seg.get(tag) or []
        if not pts:
            checks.append({"tag": tag, "baseline": base, "band": band, "last": 0.0, "passed": False})
            continue
        last = float(pts[-1][1])
        checks.append({"tag": tag, "baseline": base, "band": band, "last": last,
                       "passed": abs(last - base) <= band + 1e-9})
    ok = bool(checks) and all(c["passed"] for c in checks)
    return {"status": "verified_effective" if ok else "reopened", "checks": checks}
