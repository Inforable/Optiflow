# DEV PLAN: Optiflow LubeGuard R0 (2 developers, about 5 hours, Claude Code)

Goal: ship the PRD's R0 hero journey live on Cloud Run in about 5 hours with two developers working in parallel with Claude Code, then record the demo. Product spec: `docs/PRD.md`. Domain detail: `docs/NICHE_DECISION.md`. Shared AI context for both Claude sessions: `CLAUDE.md` (repo root).

**Two roles:**
- **Dev A: Backend, data and AI.** Python, FastAPI, Gemini, ADK, BigQuery, Firestore Admin, Cloud Run deploy.
- **Dev B: Frontend and UX.** React (Vite), Tailwind (Proteus Guardian style), Firebase client (Auth, Firestore, Storage), landing page, Manager console, Engineer PWA (offline).

**The rule that makes parallel work possible:** at 0:30 Dev A pushes the **contracts** (`contracts/`) and **fixtures** (`fixtures/`). Dev B builds every screen against the fixtures and never waits for the backend. From 2:00 Dev B switches from fixtures to the live API and Firestore, with no UI changes because the shapes are identical.

---

## 0. Timeline at a glance (H = hours from kickoff)

| Time | Dev A (backend, data, AI) | Dev B (frontend, UX) | Sync point |
|---|---|---|---|
| 0:00 to 0:30 | GCP and Firebase setup, backend scaffold, **contracts and fixtures pushed** | Frontend scaffold, design tokens, router, Firebase client, app shells | **CP0 at 0:30:** both run locally; fixtures on `main` |
| 0:30 to 1:15 | Synthetic data generator, BigQuery load, anomaly detection (with precomputed fallback) | Landing page and demo entry (role choice, join code) | |
| 1:15 to 2:00 | Domain rules, Investigator agent, `/investigate` writing the Case to Firestore with a live trace | Incident Room on fixtures: skid diagram, chart, matrix, trace, actions | **CP1 at 2:00:** first Cloud Run deploy; Incident Room reads a real Case |
| 2:00 to 2:45 | Evidence-request tickets, evidence judge, re-diagnosis, notifications | Switch to live data; Tickets list; notification bell; Overview | |
| 2:45 to 3:30 | Advisor and approve-to-tickets, verification, knowledge-graph API, Ask | Engineer PWA: join, My Tasks, checklist, evidence capture, offline queue | **CP2 at 3:30:** full hero journey online, laptop plus phone |
| 3:30 to 4:30 | Reset, cached fallbacks, eval script, backend README, Cloud Run hardening | Knowledge-graph view, Ask panel, offline test on the real phone, polish | **CP3 at 4:30:** offline round trip works; feature freeze |
| 4:30 to 5:00 | Final deploy, tag `v0.1.0`, smoke test | Raw screen recording of the demo (backup footage) | Release |
| After 5:00 | Deck PDF (architecture, eval) | Video edit (3:00 to 3:02, subtitles) | Submit at least 2 hours before the deadline |

If you fall behind, apply the cut list in section 9 at CP1 and CP2. Do not skip checkpoints.

---

## 1. Kickoff (both, 0:00 to 0:30)

### 1.1 Do first (5 minutes, together)
1. Merge PR #1 (docs) into `main`. Both pull `main`.
2. Confirm the **exact submission deadline time** on the Hack2skill dashboard and write it at the top of this file.
3. Agree on who is Dev A and who is Dev B.
4. Each opens Claude Code in the repo root (it reads `CLAUDE.md` automatically).

### 1.2 Dev A: cloud setup (15 minutes)

| Step | Command or action |
|---|---|
| Project | Use one GCP project with billing linked. `gcloud config set project <PROJECT_ID>` |
| APIs | `gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com bigquery.googleapis.com firestore.googleapis.com storage.googleapis.com secretmanager.googleapis.com aiplatform.googleapis.com` |
| Firebase | Firebase console: add the same GCP project; enable **Anonymous** sign-in; create **Firestore** (Native, `asia-southeast2`); create the default **Storage** bucket; register a Web app and copy its config to Dev B |
| Gemini key | AI Studio key on the billing-linked project. `printf "%s" "$KEY" \| gcloud secrets create GEMINI_API_KEY --data-file=-` |
| BigQuery | `bq mk --location=US lube` (US multi-region is the safe choice for BigQuery AI functions; switch only if you have verified the function in your region) |
| Service account | Cloud Run default compute service account gets: `roles/datastore.user`, `roles/bigquery.user`, `roles/bigquery.dataViewer`, `roles/storage.objectAdmin`, `roles/secretmanager.secretAccessor` |
| Local auth | `gcloud auth application-default login` |

### 1.3 Repo structure (created at kickoff; ownership is strict)

```
/
├── CLAUDE.md                  shared (agreed at kickoff)
├── README.md                  shared (A backend part, B frontend part)
├── docs/                      shared (read-only during the build)
├── contracts/                 Dev A owns, Dev B reviews
│   ├── api.md                 endpoints, requests, responses
│   ├── case.schema.json       the Case object
│   └── firestore.md           collections, fields, storage paths
├── fixtures/                  Dev A owns
│   ├── case_C0412_open.json       after investigate, Material UNVERIFIED
│   ├── case_C0412_evidence.json   after the oil photo, Material NG, actions proposed
│   ├── case_C0412_verified.json   after approve and verify
│   ├── tickets.json
│   ├── kg.json                    nodes, edges, highlight path
│   └── ask_examples.json          one answered, one refused
├── backend/                   Dev A owns
│   ├── app/main.py            FastAPI; serves /api and the built frontend
│   ├── app/routes/            demo.py, cases.py, evidence.py, tickets.py, kg.py, ask.py
│   ├── app/agents/            investigator.py, advisor.py, judge.py, ask.py
│   ├── app/rules/             pressure_path.py, oil_limits.py, autostart.py, bearings.py, loss.py, verify.py
│   ├── app/services/          firestore.py, bigquery.py, storage.py, sandbox.py, kg.py, fallback.py
│   ├── data/                  sops/SOP-LO-01..08.md, incidents.json, setpoints.json, oil_lab.json, autostart_tests.json, kg.json
│   ├── scripts/               generate_data.py, load_bigquery.py, detect_anomalies.sql, eval.py
│   └── requirements.txt
├── frontend/                  Dev B owns
│   ├── src/pages/landing/     LandingPage.jsx
│   ├── src/pages/manager/     Overview.jsx, IncidentRoom.jsx, Tickets.jsx, KnowledgeGraph.jsx
│   ├── src/pages/engineer/    Join.jsx, MyTasks.jsx, TaskDetail.jsx, Capture.jsx
│   ├── src/components/        SkidDiagram, MatrixGrid, TraceTimeline, ProvenanceChip, StatusPill, KpiCard, NextBestAction, AskPanel, NotificationBell, OfflineBanner, SyncBadge
│   ├── src/lib/               firebase.js, api.js, offlineQueue.js, useCase.js, useFixtures.js
│   └── vite.config.js         includes vite-plugin-pwa
├── firestore.rules            Dev B owns, Dev A reviews
├── storage.rules              Dev B owns
├── Dockerfile                 Dev A owns (multi-stage: build frontend, run backend)
└── .env.example               shared
```

### 1.4 Git workflow
- Both commit to `main` in small commits, only inside the folders you own. `git pull --rebase` before every push.
- Contract changes after CP0: say it in chat first, then Dev A edits `contracts/` and the fixtures in one commit.
- Never commit keys. Firebase web config is public and may be committed; the Gemini key lives in Secret Manager and `.env` (ignored).
- Commit messages: `feat(backend): ...`, `feat(frontend): ...`, `fix: ...`, `chore: ...`.

---

## 2. Contracts (fixed at CP0)

### 2.1 Identity and sandboxes
- Firebase **Anonymous Auth** in the browser. Every API call sends `Authorization: Bearer <Firebase ID token>`; the backend verifies it with `firebase-admin`.
- Every demo visitor gets their own **sandbox**: a copy of case C-0412 and its data under `sandboxes/{sid}`. The Manager creates it; the Engineer joins it with a 6-character **join code** (shown as text and as a QR code on the Manager header, URL `/e/join?code=7KQ2PX`). This makes "laptop as Manager, phone as Engineer" work in the demo and keeps judges from colliding.

### 2.2 Firestore model (all under `sandboxes/{sid}`)

| Path | Fields |
|---|---|
| `sandboxes/{sid}` | `code`, `createdAt`, `members` (map uid to role), `caseId`, `names` (map role to display name: Manager "Dimas, Maintenance Supervisor", Engineer "Joko, Field Engineer") |
| `cases/{caseId}` | The Case object (2.4). Backend writes; clients read |
| `tickets/{ticketId}` | `id`, `type` (`evidence_request`, `corrective`, `safety_test`), `title`, `caseId`, `component`, `priority` (`high`, `medium`, `low`), `dueAt`, `estimateMin`, `assigneeRole`, `assigneeName`, `status` (`open`, `in_progress`, `on_hold`, `done`, `verified`), `checklist` (array of `{id, text, sopRef}`), `evidenceRequest` (`{category, instruction}` or null), `createdBy` (`ai` or `human`), `createdAt`, `report` |
| `tickets/{ticketId}/progress/{stepId}` | `done`, `note`, `reading`, `by`, `at`. **Written by the Engineer app, offline-safe** |
| `evidence/{evidenceId}` | `id`, `ticketId`, `caseId`, `kind` (`photo`, `voice`, `gauge`), `storagePath`, `uploadedAt`, `judged` (`{verdict, finding, reason, confidence, transcript}`), `by` |
| `notifications/{nid}` | `toRole`, `event`, `title`, `body`, `ref` (`{caseId, ticketId}`), `read`, `at` |

Storage path: `sandboxes/{sid}/evidence/{ticketId}/{evidenceId}.{jpg|webm}`.

Security rules (Dev B writes): signed-in users may read and write under `sandboxes/{sid}` only if `request.auth.uid in get(/databases/$(database)/documents/sandboxes/$(sid)).data.members`. The Engineer may write `progress` and `evidence`; `cases` and `tickets` are written by the backend (Admin SDK bypasses rules). Storage: same membership check on `sandboxes/{sid}/...`.

### 2.3 API (all JSON, prefix `/api`)

| Method and path | Request | Response | Side effects |
|---|---|---|---|
| `POST /demo/session` | `{role: "manager"}` | `{sandboxId, code, caseId}` | Creates sandbox, seeds case C-0412 (pre-investigation state) and data |
| `POST /demo/join` | `{code}` | `{sandboxId, role: "engineer", caseId}` | Adds uid as engineer |
| `POST /demo/reset` | `{sandboxId}` | `{ok: true}` | Re-seeds the sandbox |
| `POST /cases/{caseId}/investigate` | `{sandboxId}` | Case | Runs detection summary, rules, Investigator; **appends `trace` entries to Firestore as each tool runs**; writes the Case |
| `POST /cases/{caseId}/evidence-request` | `{sandboxId, category: "material"}` | Ticket | Creates an `evidence_request` ticket for the Engineer with checklist from SOP-LO-04 section 2; notification to engineer |
| `POST /evidence` | `{sandboxId, ticketId, caseId, kind, storagePath, note}` | Evidence | Judges with Gemini; re-runs the structuring step; updates the Case (Material NG, root cause, Advisor actions); notification to manager |
| `POST /cases/{caseId}/approve` | `{sandboxId, actionIds: []}` | `{tickets: []}` | Creates corrective and safety tickets (RACI assignee); notifications |
| `POST /tickets/{ticketId}/complete` | `{sandboxId, report: {summary, condition}}` | Ticket | Status `done`; notification to manager |
| `POST /cases/{caseId}/verify` | `{sandboxId}` | Case | Appends replayed post-repair readings; runs verification; status `verified` or `reopened` |
| `GET /kg?sandboxId=&caseId=` | | `{nodes, edges, highlight}` | |
| `POST /ask` | `{sandboxId, question, caseId}` | `{answer, citations: [{id, type, label}], refused}` | |
| `GET /health` | | `{ok: true, version}` | |

Latency budget: `investigate` up to 30 s (the UI animates the trace from Firestore while waiting); `evidence` up to 15 s; `ask` up to 8 s. Every Gemini step has a cached fallback (section 8).

### 2.4 The Case object (shape of `fixtures/case_C0412_*.json`)

```json
{
  "id": "C-0412",
  "sandboxId": "sbx_x1",
  "asset": {"id": "ST-01", "name": "Steam turbine ST-01, Unit 2", "system": "LO-01 lube-oil console"},
  "title": "Lube-oil header pressure decay",
  "status": "investigating",
  "openedAt": "2026-10-18T02:00:00+07:00",
  "syntheticDataNote": "Synthetic demo plant. SITE SETPOINTS are not standards.",
  "readings": {
    "interval": "1h",
    "series": {
      "PT-104": [["2026-10-13T02:00:00+07:00", 1.60]],
      "PDT-101": [["2026-10-13T02:00:00+07:00", 0.30]],
      "LT-101": [["2026-10-13T02:00:00+07:00", 70.0]],
      "TE-201": [["2026-10-13T02:00:00+07:00", 88.0]],
      "IT-104A": [["2026-10-13T02:00:00+07:00", 62.0]]
    },
    "setpoints": {"PT-104": {"low": 1.2, "lowLow": 0.8, "unit": "barg"}, "PDT-101": {"change": 1.0, "unit": "bar"}, "TE-201": {"alarm": 115, "trip": 125, "unit": "degC"}}
  },
  "detection": {
    "method": "BigQuery AI.DETECT_ANOMALIES (TimesFM 2.5), per signal",
    "tags": [{"tag": "PT-104", "anomalous": true, "probability": 0.98, "slopePerDay": -0.06}],
    "driftCheck": {"verdict": "physical", "reason": "PT-104, PDT-101 and LT-101 move together; not a single-sensor drift"}
  },
  "pressurePath": {"ruleId": "R-T5", "mechanism": "filter_loading", "label": "Filter loading", "evidence": "PT-104 down, PDT-101 up, PT-106 flat; LT-101 rising (+2%)"},
  "autostart": {"ruleId": "R-T4", "marginToPslBar": 0.1, "lastTestDays": 47, "sopIntervalDays": 30, "verdict": "NG", "label": "Auto-start test overdue"},
  "impact": {"lossPerMinUsd": 0, "exposureUsd": 2140000, "formula": "72 h median similar downtime x US$29,721/h (problem brief)", "assumptions": ["72 h downtime from similar incidents (synthetic)"]},
  "diagnosis": {
    "matrix": {
      "man": {"verdict": "G", "evidence": "Operator log follows SOP; no handling deviation", "citations": ["SOP-LO-02 §1"], "provenance": "ai"},
      "machine": {"verdict": "NG", "evidence": "Filter F-101A loading (R-T5); pump P-104A healthy: current flat, vibration zone A (R-P1)", "citations": ["R-T5", "R-P1"], "provenance": "ai"},
      "method": {"verdict": "NG", "evidence": "Auto-start test 47 days old vs 30-day SOP interval; 0.1 bar margin to PSL-104 (R-T4)", "citations": ["R-T4", "SOP-LO-05 §1"], "provenance": "ai"},
      "material": {"verdict": "UNVERIFIED", "evidence": "Last lab sample 21 days old (normal); level rising suggests something is entering the oil", "citations": ["R-T1"], "provenance": "ai"},
      "environment": {"verdict": "UNVERIFIED", "evidence": "Cooling-water side not yet checked", "citations": [], "provenance": "ai"}
    },
    "rootCause": null,
    "evidenceRequests": [{"category": "material", "instruction": "Take an oil sample from the reservoir drain into a clear bottle and photograph it against a light.", "sopRef": "SOP-LO-04 §2"}]
  },
  "evidence": [],
  "decision": {"actions": [], "approvedActionIds": []},
  "ticketIds": [],
  "verification": {"status": "pending", "checks": []},
  "trace": [
    {"at": "2026-10-18T02:00:05+07:00", "step": "query_signals", "summary": "Pulled 5 days of PT-104, PDT-101, LT-101, TE-201, IT-104A", "provenance": "ai"},
    {"at": "2026-10-18T02:00:09+07:00", "step": "classify_pressure_path", "summary": "R-T5: filter loading", "provenance": "ai"}
  ],
  "audit": {"model": "gemini-3.8-flash", "promptVersion": "v1", "cached": false}
}
```

`case_C0412_evidence.json` differs: `material` is `NG` ("Oil not clear and bright: free water suspected", citations `["R-T1", "evidence:EV-1"]`, provenance `human` for the photo plus `ai` for the judgment), `environment` is `NG` (cooler E-101A leak suspected), `rootCause` is `{"text": "Cooling water leaking through oil cooler E-101A emulsifies the oil, loads filter F-101A and starves the header", "path": ["E-101A", "OIL", "F-101A", "HEADER", "BRG-1"]}`, `evidence` has the judged photo, and `decision.actions` lists 5 actions (`A1` switch to F-101B, `A2` isolate E-101A, `A3` auto-start test, `A4` purifier, `A5` retube E-101A) each with `quadrant`, `authority`, `timing` and `sopCitations`. `case_C0412_verified.json` adds post-repair readings and `verification.status = "verified_effective"`.

Detail for every value: `docs/NICHE_DECISION.md` sections 3 to 6.

---

## 3. Dev A: backend, data and AI

Owns: `backend/`, `contracts/`, `fixtures/`, `Dockerfile`, `.env.example` (backend part). Stack: Python 3.11, FastAPI, `google-genai`, `google-adk`, `google-cloud-bigquery`, `firebase-admin`, `google-cloud-storage`, Pydantic.

### A0 (0:00 to 0:30): scaffold, contracts, fixtures. Done when fixtures are on `main`.

Claude prompt:
> Read CLAUDE.md, docs/DEV_PLAN.md sections 1 to 2, docs/PRD.md sections 8 to 11 and docs/NICHE_DECISION.md sections 3 to 6. Create the `backend/` FastAPI skeleton exactly as in DEV_PLAN section 1.3 with a `/api/health` route, Pydantic models matching the Case object in DEV_PLAN section 2.4, and stub routes for every endpoint in section 2.3 that return the matching fixture. Then write `contracts/api.md`, `contracts/case.schema.json` (JSON Schema of the Case), `contracts/firestore.md`, and the fixtures `fixtures/case_C0412_open.json`, `case_C0412_evidence.json`, `case_C0412_verified.json`, `tickets.json`, `kg.json` (nodes and edges of the lube-oil system from NICHE_DECISION section 3, with a `highlight` path), and `ask_examples.json`. Use realistic hourly readings over 5 days that follow NICHE_DECISION section 6 (PT-104 1.6 to 1.3 barg, PDT-101 0.3 to 0.9 bar, LT-101 70 to 72 percent, TE-201 +6 degC, IT-104A flat). Only edit `backend/`, `contracts/`, `fixtures/`.

### A1 (0:30 to 1:15): synthetic data and detection. Done when `lube.lube_readings` is loaded and anomalies are computed (or the fallback is used).

Claude prompt:
> Write `backend/scripts/generate_data.py`: a seeded, physics-informed generator for the lube-oil console in docs/NICHE_DECISION.md sections 3.3 and 6 (1-minute data, 14 days) for the hero scenario (water ingress via cooler E-101A) plus two extra scenarios: pump wear (F3) and external leak (F4). Header pressure = pump discharge minus filter dP minus line losses; filter dP grows with contamination; contamination grows with water ppm; reservoir level rises with water ingress; bearing temperature rises as header pressure falls; add realistic noise. Also write the post-repair segment. Output CSV to `backend/data/generated/` and hourly downsampled series into the fixtures. Write `backend/scripts/load_bigquery.py` to load into dataset `lube`, table `lube_readings(tag, ts, value, unit, scenario)`. Write `backend/scripts/detect_anomalies.sql` using `AI.DETECT_ANOMALIES` per tag (`id_cols => ['tag']`, history before the last 5 days, target the last 5 days) and `backend/app/services/bigquery.py` to run it; if the query fails, read precomputed results from `backend/data/generated/anomalies.json`. Generate that precomputed file too. Also write `backend/data/setpoints.json`, `oil_lab.json` (last sample 21 days ago, normal), `autostart_tests.json` (last test 47 days ago), and label everything synthetic.

### A2 (1:15 to 2:00): rules and the Investigator. Done when `/investigate` writes a Case with Material UNVERIFIED to Firestore and the trace appears live. **CP1: deploy to Cloud Run.**

Claude prompt:
> Implement the domain rules in `backend/app/rules/` from docs/NICHE_DECISION.md section 5 and docs/PRD.md section 8.5 as pure, unit-tested Python functions that return a verdict, a label, the evidence string and the rule id: `pressure_path.py` (R-T5 slope classifier), `oil_limits.py` (R-T1, R-T2), `autostart.py` (R-T4 with margin and test age), `bearings.py` (R-T3), `loss.py` (exposure = median similar-incident downtime x 29721), `verify.py` (baseline bands). Write the SOPs `backend/data/sops/SOP-LO-01.md` to `SOP-LO-08.md` (synthetic, short, sections numbered like `§2`, content per NICHE_DECISION section 6) and `backend/data/incidents.json` (30 synthetic incidents across failure modes F1 to F12). Then build the Investigator in `backend/app/agents/investigator.py` with ADK (`google-adk`, model `gemini-3.8-flash`, API key from env `GEMINI_API_KEY`): tools `query_signals`, `classify_pressure_path`, `get_oil_lab_results`, `check_autostart_readiness`, `get_asset_context`, `get_pump_motor_health`, `search_similar_incidents` (match by failure mode in incidents.json), `get_field_evidence`, `get_graph_neighbourhood` (from data/kg.json). Each tool call appends a trace entry to Firestore `sandboxes/{sid}/cases/{caseId}.trace` immediately. After the agent, run a separate structuring call (no tools) that returns the 4M+1E matrix as a Pydantic model; then in code downgrade any verdict whose citations do not exist (rule ids, SOP sections, evidence ids) to UNVERIFIED and create an evidence request for UNVERIFIED Material. If ADK wiring is not working within 30 minutes, implement the same loop with `google-genai` automatic function calling using the same tool functions. Wire `POST /api/cases/{caseId}/investigate` and `POST /api/demo/session` (create sandbox, 6-character code, seed case from fixtures/case_C0412_open.json with diagnosis cleared). Write the multi-stage `Dockerfile` (node build of `frontend/` into `/app/static`, then python) and deploy: `gcloud run deploy optiflow --source . --region asia-southeast2 --allow-unauthenticated --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest --timeout 300`.

### A3 (2:00 to 2:45): evidence loop. Done when uploading the hazy-oil photo flips Material to NG in Firestore.

Claude prompt:
> Implement `POST /api/cases/{caseId}/evidence-request` (creates an `evidence_request` ticket for the engineer with checklist steps from SOP-LO-04 §2, and a notification), and `POST /api/evidence`: download the file from Cloud Storage, judge it with `backend/app/agents/judge.py` using `gemini-3.8-flash` with the image (or audio) part and a strict checklist from docs/NICHE_DECISION.md section 4 (clear and bright = G; hazy or milky = NG free water; dark = NG oxidation; foam; particles), structured output `{verdict, finding, reason, confidence, transcript}`; a clear-oil photo must return G. Save the evidence doc, re-run the structuring step with the new evidence, set `rootCause` with its graph path, call the Advisor (next task, stub for now), write the Case, and notify the manager. Add notification helpers in `backend/app/services/firestore.py`.

### A4 (2:45 to 3:30): Advisor, approval, verification, graph, Ask. Done at **CP2**.

Claude prompt:
> Implement `backend/app/agents/advisor.py`: `gemini-3.8-flash` with the 8 SOP files in the prompt and the current matrix; returns actions mapped to NG categories, each step citing an SOP section; validate in code that every cited section exists (replace uncited steps with "Escalate to on-call engineer"); quadrant and authority come from a small table in code (shift, plant, HO), not from the model; timing rule: shift-authority actions "now", outage actions "next planned shutdown". Implement `POST /api/cases/{caseId}/approve` (creates tickets with RACI assignee from `backend/data/raci.json`, notifications), `POST /api/tickets/{ticketId}/complete`, `POST /api/cases/{caseId}/verify` (append post-repair readings, run `rules/verify.py`, set status, write back a verified incident). Implement `GET /api/kg` (nodes, edges, highlight = rootCause.path) and `POST /api/ask` in `backend/app/agents/ask.py`: retrieve the 2-hop neighbourhood of the case's affected components plus linked SOP sections and incidents from data/kg.json, answer only from that context with `gemini-3.8-flash`, return citations as node ids, validate them, and return `refused: true` with "0 sources, answer refused" when retrieval is empty or the question is out of scope.

### A5 (3:30 to 4:30): hardening and eval. Done at **CP3**.

Claude prompt:
> Add `POST /api/demo/join` and `POST /api/demo/reset`. Add cached fallbacks in `backend/app/services/fallback.py`: if any Gemini step errors or exceeds 25 seconds, return the matching fixture state with `audit.cached = true`. Add Firebase ID-token verification to every route except health. Write `backend/scripts/eval.py`: 10 golden cases (hero, clear-oil control, pump wear, external leak, cooler fouling, auto-start overdue, drift, two out-of-scope Ask questions, one in-scope Ask) that call the deployed API and report R-T5 accuracy, matrix category accuracy, citation validity, photo verdict accuracy and refusal correctness into `backend/eval_results.json`. Write the backend part of README (setup, env vars, deploy, synthetic-data note, rule sources). Redeploy with `--min-instances 1`.

### A6 (4:30 to 5:00): release
Final deploy, `git tag v0.1.0`, run the smoke test in section 7 with Dev B, then start the deck (section 10).

---

## 4. Dev B: frontend and UX

Owns: `frontend/`, `firestore.rules`, `storage.rules`, Firebase web config. Stack: React 18 + Vite (JavaScript), Tailwind, react-router, framer-motion, lucide-react, recharts, react-hot-toast, firebase (Auth, Firestore, Storage), cytoscape (or react-cytoscapejs), qrcode.react, idb-keyval, vite-plugin-pwa.

Design: Proteus Guardian visual language (tokens in `CLAUDE.md` and `docs/PRD.md` section 13), components re-created in this repo. Keep the Proteus Guardian repo open locally as a visual reference and point Claude at specific files when you want the same look.

### B0 (0:00 to 0:30): scaffold. Done when the app shells render locally.

Claude prompt:
> Read CLAUDE.md, docs/DEV_PLAN.md sections 1, 2 and 4, docs/PRD.md sections 6, 8 and 13. Create `frontend/` with Vite + React (JavaScript) + Tailwind using the design tokens in CLAUDE.md (define the full dark neutral ramp 950 to 500, cyan primary, purple for AI, status colours), Inter and JetBrains Mono from Google Fonts, react-router routes: `/` landing, `/m` Manager shell (collapsible sidebar with glowing active item, top bar with join code, notification bell and role menu), `/m/case/:caseId`, `/m/tickets`, `/m/graph`, `/e` Engineer shell (bottom tab bar: Tasks, Capture, Alerts), `/e/join`, `/e/task/:ticketId`. Add `src/lib/firebase.js` (anonymous sign-in, Firestore with `persistentLocalCache` and `persistentMultipleTabManager`, Storage), `src/lib/api.js` (fetch wrapper adding the Firebase ID token, base URL from `VITE_API_BASE` or same origin), and `src/lib/useFixtures.js` that loads `/fixtures/*.json` when `VITE_USE_FIXTURES=true`. Shared components: StatusPill (G green, NG red, UNVERIFIED amber, always with an icon), ProvenanceChip (Human blue user icon, AI purple bot icon), KpiCard, glass panel. Only edit `frontend/`.

### B1 (0:30 to 1:15): landing page and demo entry. Done when "Enter as Manager" creates a session (fixture mode is fine) and shows the join code.

Claude prompt:
> Build `src/pages/landing/LandingPage.jsx` following docs/PRD.md section 8.1 (LND-01 to LND-09) in the Proteus Guardian anatomy: sticky glass navbar; hero with an eyebrow pill "Turbine lube-oil reliability", two-line headline with a cyan-to-blue gradient second line ("From signal to verified fix," / "for the oil that keeps your turbine alive."), one-sentence sub-copy, two pill CTAs "Enter as Manager" and "Enter as Engineer", cyan glow blob; a product preview inside a fake browser frame showing a miniature Incident Room (header pressure trend, matrix with one amber UNVERIFIED cell, an AI insight card citing "SOP-LO-04 §2"); a stats band with only these cited numbers: "US$29,721 per downtime hour (problem brief: US$67.2M / 2,261 h)" and "US$1.4T yearly cost of unplanned downtime at the 500 largest companies (Siemens 2024)"; three glass value cards Proven, Priced, Verified; a two-role split; a "Built on Google Cloud and Gemini" strip; a glass CTA panel; a footer with repo link and "Synthetic demo data". "Enter as Manager" calls `POST /api/demo/session` then routes to `/m/case/C-0412`; "Enter as Engineer" routes to `/e/join`. Use framer-motion fade-up on scroll, nothing heavy.

### B2 (1:15 to 2:00): Incident Room on fixtures. Done when the full hero UI renders from fixtures. **CP1:** switch to the live Case via a Firestore listener.

Claude prompt:
> Build `src/pages/manager/IncidentRoom.jsx` from docs/PRD.md MGR-02 and section 13.1. Layout: top severity header (case title, asset, pulsing red dot, status, "Run investigation" button that calls `POST /api/cases/{id}/investigate`); left column `TraceTimeline` (entries from `case.trace`, each with a ProvenanceChip, animate new entries); centre `SkidDiagram` (an original interactive SVG of the lube-oil console from docs/NICHE_DECISION.md section 3.1: reservoir, P-104A, P-104B, P-105 DC pump, duplex filter F-101A/B, duplex cooler E-101A/B, PCV-101, header, journal bearings 1 and 2, thrust bearing; live tag chips for PT-104, PDT-101, LT-101, TE-201, IT-104A with values from the last reading; components coloured by status; `case.diagnosis.rootCause.path` highlighted with an animated cyan flow; click a component to open a drawer), below it a recharts chart of PT-104 and PDT-101 with dashed setpoint lines; right column: detection badge, pressure-path chip, auto-start readiness card, exposure card with the formula in a tooltip, `MatrixGrid` (5 cells Man, Machine, Method, Material, Environment with StatusPill, evidence text and citation chips), and for an UNVERIFIED cell a "Send evidence request" button (`POST /api/cases/{id}/evidence-request`). Under the matrix: evidence gallery and `NextBestAction` plus action cards (quadrant badge, authority badge, SOP citations, checkbox) with an "Approve selected" button (`POST /api/cases/{id}/approve`). Read the Case through `src/lib/useCase.js`: fixtures in fixture mode, otherwise an `onSnapshot` listener on `sandboxes/{sid}/cases/{caseId}`. Every number shows "synthetic" or its formula on hover.

### B3 (2:00 to 2:45): live data, Tickets, notifications, Overview. Done when tickets created by the backend appear live.

Claude prompt:
> Switch the app to live mode (`VITE_USE_FIXTURES=false`) against the deployed API and Firestore. Build `src/pages/manager/Tickets.jsx` (list with status filter; columns: title, type, component, assignee, priority, due, status, created by chip; row click opens a side drawer with checklist progress from `tickets/{id}/progress`, evidence thumbnails, status change and reassign) and a "New ticket" modal in the Proteus modal style. Build `NotificationBell` (Firestore listener on `notifications` where `toRole == "manager"`, unread count, list, click navigates). Build a minimal `Overview.jsx`: KPI row (open cases, open tickets, verified fixes, current exposure), a small SkidDiagram, the case card, and the join code with a QR code (`qrcode.react`) linking to `/e/join?code=...`.

### B4 (2:45 to 3:30): Engineer PWA. Done at **CP2**: the phone receives the task and the photo flips Material on the laptop.

Claude prompt:
> Build the Engineer app per docs/PRD.md section 8.4 and section 11.1, mobile-first and glove-friendly (48 px touch targets, large type, high contrast, English with a Bahasa toggle for labels). `Join.jsx`: read `code` from the URL or input, anonymous sign-in, `POST /api/demo/join`. `MyTasks.jsx`: Firestore listener on tickets where `assigneeRole == "engineer"`, task cards like the Proteus recommendation card (component, priority, due, steps count). `TaskDetail.jsx`: checklist rows with pass, fail and N/A, note and reading inputs, each step showing its SOP reference; writes go to `tickets/{id}/progress/{stepId}` (works offline through Firestore persistence). `Capture.jsx` (also embedded in TaskDetail): camera photo via `<input type=file accept=image/* capture=environment>`, voice note via MediaRecorder, optional "Use sample photo" and "Use sample voice note" buttons (files in `public/samples/`). Implement `src/lib/offlineQueue.js`: save each blob with metadata to IndexedDB (idb-keyval); when online, upload to Storage at `sandboxes/{sid}/evidence/{ticketId}/{evidenceId}.{ext}` with `uploadBytes`, then call `POST /api/evidence`; retry on `online` events and on app focus; expose per-item state (queued, uploading, synced, failed). Add `OfflineBanner` ("Offline: 2 items queued") and `SyncBadge`. "Submit report" calls `POST /api/tickets/{id}/complete` (queued until online). Configure `vite-plugin-pwa` (manifest with name "LubeGuard Engineer", theme colour #0B0E14, icons, offline app shell caching). Write `firestore.rules` and `storage.rules` per docs/DEV_PLAN.md section 2.2.

### B5 (3:30 to 4:30): graph, Ask, real-phone offline test, polish. Done at **CP3**.

Claude prompt:
> Build `src/pages/manager/KnowledgeGraph.jsx` with Cytoscape on a dot-grid dark canvas: nodes from `GET /api/kg` coloured by type (component, tag, failure mode, rule, SOP section, incident, case), the highlight path glowing cyan, a right detail panel styled like a glass card. Build `AskPanel` (in the Incident Room right column and on the graph page): chat bubbles in the Proteus style, suggested prompts ("Why is the filter loading?", "What does SOP-LO-05 say about the auto-start test?", "Who won the World Cup?"), answers with citation chips that focus the graph node, refused answers shown as "0 sources, answer refused". Then polish: loading skeletons, toasts for sync and approvals, empty states, the synthetic-data footer on every page, and a "Reset demo" item in the role menu (`POST /api/demo/reset`).

Then the **real-phone offline test** (do not skip): open `/e/join` on the demo phone from the QR code, accept the task, switch on airplane mode, capture the photo and voice note, tick the steps, switch airplane mode off, and confirm the laptop's Material cell flips within 30 seconds.

### B6 (4:30 to 5:00): record
Record the full hero journey from the deployed URL (laptop screen plus phone screen) as backup footage, following section 7.

---

## 5. Integration checkpoints (definition of done)

| Checkpoint | Must be true | If not |
|---|---|---|
| **CP0 (0:30)** | Both run locally; contracts and fixtures on `main`; GCP, Firebase, Gemini secret ready | Dev A finishes setup while Dev B continues on fixtures |
| **CP1 (2:00)** | Cloud Run URL serves the landing page; "Enter as Manager" creates a sandbox; "Run investigation" writes the Case; Incident Room shows Material UNVERIFIED with a live trace | Apply cuts 1 and 2 (section 9); Dev A fixes deploy before anything else |
| **CP2 (3:30)** | Full hero journey online on laptop plus phone: evidence request, task on the phone, photo upload, Material NG, actions, approve, tickets, verify | Apply cuts 3 and 4 |
| **CP3 (4:30)** | Offline round trip works on the real phone; Reset works; eval numbers exist; README sections written | Apply cut 5; freeze anyway |

---

## 6. Environment variables

| Name | Where | Value |
|---|---|---|
| `GEMINI_API_KEY` | Backend (Secret Manager on Cloud Run, `.env` locally) | AI Studio key on the billing-linked project |
| `GOOGLE_CLOUD_PROJECT` | Backend | Project id |
| `BQ_DATASET` | Backend | `lube` |
| `GEMINI_MODEL` | Backend | `gemini-3.8-flash` |
| `STORAGE_BUCKET` | Backend and frontend | Firebase default bucket |
| `VITE_FIREBASE_*` | Frontend | Firebase web config (public) |
| `VITE_API_BASE` | Frontend | Empty in production (same origin); `http://localhost:8080` locally |
| `VITE_USE_FIXTURES` | Frontend | `true` until CP1 |

---

## 7. Demo script and smoke test (run 3 times before recording)

1. Landing page loads on the deployed URL; click "Enter as Manager".
2. Incident Room: click "Run investigation"; trace animates; matrix shows Filter NG, Pump G, Method NG (auto-start overdue), **Material UNVERIFIED**.
3. Click "Send evidence request" on Material.
4. Phone: scan the QR code on the Manager header; the task appears.
5. Phone: airplane mode on; follow the checklist; take the oil photo (hazy oil: turbine oil shaken with water in a clear bottle) and record "Olinya keruh, seperti susu"; "2 items queued".
6. Phone: airplane mode off; items sync.
7. Laptop: Material flips to **NG**; root cause "cooler E-101A leaking water"; skid path glows; actions appear.
8. Ask: "Why is the filter loading?" (answer with citations) and "Who won the World Cup?" (refused).
9. Approve A1, A2, A3; tickets appear for the Engineer and Mechanical Shift B; notifications fire.
10. Phone: complete the auto-start test task.
11. Laptop: "Verify fix": post-repair data returns to baseline; **Verified effective**.
12. Role menu: "Reset demo".

Clear-oil control (once, off camera): a clear-oil photo must judge as G.

---

## 8. Fallbacks (decide fast, do not debug past these limits)

| Problem | Limit | Fallback |
|---|---|---|
| ADK wiring | 30 minutes | `google-genai` automatic function calling with the same tools |
| `AI.DETECT_ANOMALIES` errors or flags nothing | 20 minutes | Precomputed `anomalies.json` from the generator; README states it |
| Gemini step slow or failing | 25 seconds per call | Cached fixture state, badge "cached result" |
| Cloud Run deploy or IAM | 30 minutes | Both devs stop features and fix deploy together |
| Firestore offline persistence on the demo phone | 20 minutes | Different browser (Chrome); else drop cut 5 |
| Photo judgement wrong on staged photos | 2 prompt revisions | Use the clearest staged pair; "Use sample photo" as the default path |
| Cytoscape graph | 30 minutes | Static SVG of the skid with the path highlighted |

---

## 9. Cut list (in order)

1. Knowledge-graph page becomes the highlighted skid diagram plus Ask (saves about 30 minutes).
2. Overview page becomes the KPI row only; tickets drawer becomes a simple list (saves about 30 minutes).
3. Voice note dropped; photo only (saves about 20 minutes).
4. Landing page reduced to hero, preview, value cards, CTA, footer (saves about 20 minutes).
5. Offline media queue dropped: photos need signal; checklist still works offline (saves about 40 minutes; loses the offline moment in the video).

Already out of R0: PM calendar, KPI board, PDF report, push notifications (FCM), similar-incident vector search, `AI.FORECAST`, Pub/Sub, UCI backtest, multi-unit.

---

## 10. After the build (H5 onwards)

| Task | Owner | Notes |
|---|---|---|
| Video 3:00 to 3:02 | Dev B | Follow PRD section 6 and docs/NICHE_DECISION.md section 6; burned-in English subtitles; split screen at the offline moment; show the URL once; never say stage codes |
| Deck PDF (10 slides) | Dev A | Outline in the SPEC/PRD: problem, the system we model, how it works, hero screenshots, Gemini and ADK use, architecture, eval numbers, differentiation, impact, team |
| README final | Both | "Built during the hackathon" dates, scaffold commands, dependency licences, synthetic-data and SITE SETPOINT labels, rule sources, eval results, credit "UI inspired by the team's earlier prototype" |
| Repo hygiene | Both | Translate or remove the Indonesian planning docs (English rule); no keys committed |
| Submission | Both | Live URL, public repo, video link (public), deck PDF, theme "Manufacturing: Intelligent Operations & Industrial Efficiency". **Submit at least 2 hours before the deadline** |
