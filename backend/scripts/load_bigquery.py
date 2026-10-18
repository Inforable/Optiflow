"""Load the synthetic lube-oil CSVs into BigQuery `<project>.lube.lube_readings`.

Table: lube_readings(scenario STRING, tag STRING, ts TIMESTAMP, value FLOAT64, unit STRING)
Usage:
    python backend/scripts/load_bigquery.py --project <id> [--dataset lube] [--location asia-southeast2]
    python backend/scripts/load_bigquery.py --project <id> --detect   # also run detect_anomalies.sql
Requires Application Default Credentials (gcloud auth application-default login).
"""
from __future__ import annotations

import argparse
import glob
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.join(os.path.dirname(HERE), "data", "generated")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT"))
    ap.add_argument("--dataset", default=os.environ.get("BQ_DATASET", "lube"))
    ap.add_argument("--location", default="asia-southeast2")
    ap.add_argument("--detect", action="store_true", help="run detect_anomalies.sql after loading")
    args = ap.parse_args()
    if not args.project:
        print("Set --project or GOOGLE_CLOUD_PROJECT")
        return 2

    from google.cloud import bigquery

    client = bigquery.Client(project=args.project, location=args.location)
    ds = bigquery.Dataset(f"{args.project}.{args.dataset}")
    ds.location = args.location
    ds.description = "Optiflow LubeGuard synthetic lube-oil readings (demo plant, not real data)"
    client.create_dataset(ds, exists_ok=True)

    table_id = f"{args.project}.{args.dataset}.lube_readings"
    schema = [
        bigquery.SchemaField("scenario", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("tag", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("ts", "TIMESTAMP", mode="REQUIRED"),
        bigquery.SchemaField("value", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("unit", "STRING"),
    ]
    files = sorted(glob.glob(os.path.join(GEN, "lube_readings_*.csv")))
    if not files:
        print(f"No CSVs in {GEN}; run backend/scripts/generate_data.py first")
        return 2
    for i, path in enumerate(files):
        cfg = bigquery.LoadJobConfig(
            schema=schema, source_format=bigquery.SourceFormat.CSV, skip_leading_rows=1,
            write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE if i == 0 else bigquery.WriteDisposition.WRITE_APPEND,
        )
        with open(path, "rb") as f:
            job = client.load_table_from_file(f, table_id, job_config=cfg)
        job.result()
        print(f"loaded {os.path.basename(path)}: {job.output_rows} rows")
    table = client.get_table(table_id)
    print(f"{table_id}: {table.num_rows} rows")

    if args.detect:
        sys.path.insert(0, os.path.dirname(HERE))
        os.environ.setdefault("GOOGLE_CLOUD_PROJECT", args.project)
        from app.services.bigquery import detection_sql

        for row in client.query(detection_sql(args.project, args.dataset, "hero")).result():
            print(dict(row))
    return 0


if __name__ == "__main__":
    sys.exit(main())
