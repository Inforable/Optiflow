-- Per-signal anomaly detection on the lube-oil console with TimesFM in BigQuery.
-- History: hourly means before the fault onset (2026-10-13T02:00:00+07:00).
-- Target: the last 5 days before the case opens (2026-10-18T02:00:00+07:00), hero scenario.
-- Placeholders {project}, {dataset}, {scenario}, {onset}, {case_at} are filled by
-- backend/app/services/bigquery.py. All data is synthetic.
WITH history AS (
  SELECT tag, TIMESTAMP_TRUNC(ts, HOUR) AS ts, AVG(value) AS value
  FROM `{project}.{dataset}.lube_readings`
  WHERE scenario = '{scenario}'
    AND tag IN ('PT-104', 'PDT-101', 'LT-101', 'TE-201', 'IT-104A', 'PT-106', 'VT-104A', 'TT-102')
    AND ts < TIMESTAMP('{onset}')
  GROUP BY tag, ts
),
target AS (
  SELECT tag, TIMESTAMP_TRUNC(ts, HOUR) AS ts, AVG(value) AS value
  FROM `{project}.{dataset}.lube_readings`
  WHERE scenario = '{scenario}'
    AND tag IN ('PT-104', 'PDT-101', 'LT-101', 'TE-201', 'IT-104A', 'PT-106', 'VT-104A', 'TT-102')
    AND ts >= TIMESTAMP('{onset}')
    AND ts < TIMESTAMP('{case_at}')
  GROUP BY tag, ts
),
detected AS (
  SELECT *
  FROM AI.DETECT_ANOMALIES(
    (SELECT * FROM history),
    (SELECT * FROM target),
    data_col => 'value',
    timestamp_col => 'ts',
    id_cols => ['tag'],
    anomaly_prob_threshold => 0.95
  )
)
SELECT
  tag,
  COUNTIF(is_anomaly) AS anomalies,
  COUNT(*) AS points,
  MAX(anomaly_probability) AS max_prob
FROM detected
GROUP BY tag
ORDER BY tag
