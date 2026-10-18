# Optiflow LubeGuard backend

FastAPI service for the LubeGuard demo: detection summary, deterministic domain rules, the
Investigator (ADK on `gemini-3.8-flash`), evidence judge, Advisor, grounded Ask, tickets and
notifications. One Cloud Run service also serves the built frontend.

**All plant data is synthetic** (fictional steam turbine ST-01, Unit 2). Setpoints are
SITE SETPOINTS (synthetic), not standards. Rule sources are listed in `docs/SOURCES.md`.

## Layout

| Path | What |
|---|---|
| `app/main.py` | App, CORS, routers under `/api`, `/fixtures/*`, SPA fallback from `backend/static` |
| `app/config.py` | Environment settings and modes |
| `app/models.py` | Contract models (source of truth for `contracts/` and `fixtures/`) |
| `app/routes/` | `demo`, `cases`, `evidence`, `tickets`, `kg`, `ask`, `notifications` (see `contracts/api.md`) |
| `app/rules/` | Pure rule functions: R-T5 `pressure_path`, R-T1/R-T2 `oil_limits`, R-T4 `autostart`, R-T3 `bearings`, R-P1/R-P8/R4 `pump_motor`, `loss`, `verify` |
| `app/agents/` | `investigator` (ADK + structured matrix), `judge`, `advisor`, `ask` (GraphRAG-lite) |
| `app/services/` | `store` (Memory and Firestore), `auth`, `data` (loaders, SOP sections, citation ids), `bigquery`, `storage`, `notify`, `seed` |
| `data/` | Synthetic SOPs, incidents, graph, setpoints, lab, tests, RACI, authority, generated series |
| `scripts/` | `generate_data.py`, `build_fixtures.py`, `load_bigquery.py`, `detect_anomalies.sql`, `eval.py`, `smoke_local.py` |

## Setup

```bash
cd backend
python -m venv .venv            # or: uv venv .venv --python 3.12
.venv/Scripts/pip install -r requirements.txt   # Linux/macOS: .venv/bin/pip
```

`google-genai` is pinned to 1.59.0 and `google-adk` to 1.27.5 (the newest ADK line that accepts it).

## Environment variables and modes

| Name | Default | Meaning |
|---|---|---|
| `AI_MODE` | `live` if `GEMINI_API_KEY` is set, else `cached` | `cached` replays fixture states and canned judgements (no Gemini calls) |
| `STORE` | `firestore` if `GOOGLE_CLOUD_PROJECT` is set, else `memory` | Operational store |
| `AUTH_MODE` | `firebase` with Firestore, else `off` | `off` reads `X-Dev-Uid` instead of a Firebase ID token (local only) |
| `GEMINI_API_KEY` | empty | AI Studio key (Secret Manager on Cloud Run, `.env` locally, never in git) |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Model for every agent |
| `GOOGLE_CLOUD_PROJECT` | empty | Project id (Firestore, BigQuery, Storage) |
| `BQ_DATASET` | `lube` | BigQuery dataset |
| `STORAGE_BUCKET` | empty | Firebase Storage bucket for evidence media |
| `LIVE_TIMEOUT_S` | `25` | Per live Gemini call; slower or failing calls fall back to cached with `audit.cached = true` |
| `REPLAY_DELAY_SCALE` | `1` | Multiplier for the cached trace replay pauses (0.6 to 1.2 s per step); tests use 0 |

Fallbacks never block the demo: a failing or slow Gemini call returns the cached state;
BigQuery detection falls back to `data/generated/anomalies_hero.json` (precomputed by the
synthetic generator); ADK construction problems switch the Investigator to google-genai
automatic function calling over the same tools.

## Run locally

```bash
cd backend
STORE=memory AI_MODE=cached AUTH_MODE=off .venv/Scripts/python -m uvicorn app.main:app --reload --port 8080
```

Then `GET http://localhost:8080/api/health`. A built frontend in `backend/static` (or
`/app/static`) is served at `/` with SPA fallback; `/fixtures/*` serves the repo fixtures.

## Tests, smoke and eval

```bash
cd backend
.venv/Scripts/python -m pytest -q
.venv/Scripts/python scripts/smoke_local.py --base-url http://localhost:8080
.venv/Scripts/python scripts/eval.py --base-url http://localhost:8080
```

`eval.py` runs 10 golden checks (R-T5 hero mechanism, matrix categories, Material UNVERIFIED
before evidence, hazy photo NG, clear photo G, pump-wear and external-leak scenarios through the
rules, citation validity, cited in-scope Ask, two refused out-of-scope questions) and writes
`backend/eval_results.json`. Against a deployed service with Firebase auth pass `--token <ID token>`.

## BigQuery (anomaly detection)

```bash
gcloud auth application-default login
python backend/scripts/load_bigquery.py --project <project-id> --detect
```

Loads `data/generated/lube_readings_*.csv` into `lube.lube_readings(scenario, tag, ts TIMESTAMP,
value FLOAT64, unit)` and runs `scripts/detect_anomalies.sql` (`AI.DETECT_ANOMALIES` per tag with
`id_cols => ['tag']`, history before 2026-10-13T02:00:00+07:00, target the last 5 days, hero
scenario). The API calls it only when `STORE=firestore` and a project is set.

## Deploy (Cloud Run, from the repo root)

```bash
gcloud run deploy optiflow --source . --region asia-southeast2 --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest --timeout 300
```

The repo-root `Dockerfile` builds `frontend/` with Node 22, then installs the backend on
Python 3.12 and copies the build to `backend/static`. Set `GOOGLE_CLOUD_PROJECT`,
`STORAGE_BUCKET` and `BQ_DATASET` as service env vars.

## Rule sources

R-T1/R-T2 ASTM D4378 via ExxonMobil [NR-012]; R-T3 Turbomachinery Magazine [NR-013]; R-T4 API 614
summary [NR-014]; R-T5 team ENG-LOGIC; R-P1 ISO 10816-7 via Europump [NR-024]; R-P8 and R4 NEMA MG-1
via [NE-004]; loss uses US$29,721 per downtime hour from the problem brief (US$67.2M / 2,261 h).
Full list in `docs/SOURCES.md`.
