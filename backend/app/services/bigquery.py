"""Anomaly detection with BigQuery AI.DETECT_ANOMALIES (TimesFM), with a precomputed fallback.

`run_detection()` never blocks the demo: any error (or STORE=memory, or no project) returns
backend/data/generated/anomalies_<scenario>.json, computed by the synthetic data generator.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from ..config import get_settings
from ..rules.pressure_path import slope_per_day
from .data import BACKEND_DIR, CASE_AT, ONSET_AT, anomalies, case_series_window, hourly

log = logging.getLogger("lubeguard.bigquery")

SQL_PATH = os.path.join(BACKEND_DIR, "scripts", "detect_anomalies.sql")
BQ_METHOD = "BigQuery AI.DETECT_ANOMALIES (TimesFM 2.5), per signal"
FALLBACK_METHOD = "Precomputed per-signal anomaly scores (fallback for BigQuery AI.DETECT_ANOMALIES)"


def detection_sql(project: str, dataset: str, scenario: str = "hero") -> str:
    with open(SQL_PATH, encoding="utf-8") as f:
        sql = f.read()
    return (sql.replace("{project}", project).replace("{dataset}", dataset)
            .replace("{scenario}", scenario).replace("{onset}", ONSET_AT).replace("{case_at}", CASE_AT))


def _fallback(scenario: str) -> dict:
    data = anomalies(scenario)
    return {"source": "precomputed", "method": FALLBACK_METHOD,
            "tags": [{k: t[k] for k in ("tag", "anomalous", "probability", "slopePerDay")} for t in data["tags"]]}


def _bigquery(scenario: str, timeout_s: float = 60.0) -> dict:
    from google.cloud import bigquery

    s = get_settings()
    client = bigquery.Client(project=s.google_cloud_project)
    rows = list(client.query(detection_sql(s.google_cloud_project, s.bq_dataset, scenario)).result(timeout=timeout_s))
    if not rows:
        raise RuntimeError("AI.DETECT_ANOMALIES returned no rows")
    series = case_series_window(hourly(scenario)["series"])
    tags = []
    for r in rows:
        tag = r["tag"]
        slope = slope_per_day(series.get(tag, [])) or 0.0
        share = (r["anomalies"] or 0) / max(1, r["points"] or 1)
        tags.append({"tag": tag, "anomalous": bool(share >= 0.1), "probability": round(float(r["max_prob"] or 0.0), 3),
                     "slopePerDay": round(slope, 4)})
    if not any(t["anomalous"] for t in tags):
        raise RuntimeError("AI.DETECT_ANOMALIES flagged nothing")
    return {"source": "bigquery", "method": BQ_METHOD, "tags": tags}


def run_detection(scenario: str = "hero", allow_bigquery: Optional[bool] = None) -> dict:
    s = get_settings()
    use_bq = allow_bigquery if allow_bigquery is not None else (s.store == "firestore" and bool(s.google_cloud_project))
    if use_bq:
        try:
            return _bigquery(scenario)
        except Exception as exc:
            log.warning("BigQuery detection failed, using precomputed anomalies: %s", exc)
    return _fallback(scenario)
