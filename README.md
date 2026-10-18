# Optiflow LubeGuard

**From signal to verified fix, for the oil that keeps your turbine alive.**

Reliability intelligence for **steam turbine lube-oil systems**, built for the Google Cloud AI Builder Cup 2026, theme **Manufacturing: Intelligent Operations & Industrial Efficiency**.

Optiflow LubeGuard treats every lube-oil deviation as a case that must be **proven, priced and verified**:
- **Proven:** a root-cause matrix (Man, Machine, Method, Material, Environment), each category Good, Not Good or Unverified with cited rules and evidence. When evidence is missing, the agent asks the field engineer for it (for example one photo of an oil sample).
- **Priced:** exposure and the cheapest intervention window, computed by code.
- **Verified:** the case closes only when header pressure, filter differential pressure and bearing temperature return to baseline.

Two roles: a **Manager console** (Incident Room, tickets, notifications, knowledge graph, grounded Ask) and an **offline-first Engineer app** (tasks, SOP checklists, photo and voice evidence that sync when signal returns).

> All plant data is **synthetic** (a fictional plant). Values marked SITE SETPOINT are not standards. Rule sources: `docs/SOURCES.md`.

## Architecture

| Layer | Google Cloud |
|---|---|
| Reasoning | Gemini 3.8 Flash (`gemini-3.8-flash`): Investigator and Advisor agents, structured 4M+1E verdicts, oil-photo and voice-note judgement, grounded Ask |
| Agents | Agent Development Kit (ADK) on **Cloud Run** |
| Detection | BigQuery `AI.DETECT_ANOMALIES` (TimesFM) per lube-oil signal |
| Operational data | Firestore (realtime, offline cache on the Engineer app), Firebase Auth (anonymous demo sessions) |
| Evidence | Cloud Storage |

Numbers (rule verdicts, loss, exposure, verification) are computed by code; Gemini reasons over them and explains. Citations are validated in code; anything uncited becomes Unverified.

## Repository

| Path | What |
|---|---|
| `backend/` | FastAPI API, ADK agents, domain rules, data scripts (`backend/README.md`) |
| `frontend/` | React (Vite) landing page, Manager console, Engineer PWA (`frontend/README.md`) |
| `contracts/` | API, Firestore and Case schema contracts |
| `fixtures/` | Canonical data states for case C-0412 (also used by the UI in fixtures mode) |
| `docs/` | PRD, dev plan, benchmark, niche dossier, sources, deploy guide |

## Quick start (local, no Google Cloud needed)

```bash
# backend: cached AI, in-memory store, auth off
cd backend && python -m venv .venv && . .venv/Scripts/activate && pip install -r requirements.txt
STORE=memory AI_MODE=cached AUTH_MODE=off uvicorn app.main:app --port 8080

# frontend (second terminal)
cd frontend && npm install && npm run dev      # http://localhost:5173, proxies /api to :8080
```

UI only, without the backend: `cd frontend && VITE_USE_FIXTURES=true npm run dev`.

Deploy: `docs/DEPLOY.md`.

## Demo journey

1. Landing page: **Enter as Manager**. Incident Room: **Run investigation**. The trace animates; the matrix shows Filter NG, Pump G, Method NG (auto-start test overdue) and **Material Unverified**.
2. **Send evidence request**. On a phone, scan the QR code in the Manager header to open the Engineer app.
3. Engineer, offline: follow the checklist, photograph the oil sample, record a voice note; items queue and sync when back online.
4. Manager: Material flips to **Not Good** (free water); root cause: cooling water leaking through cooler E-101A. Approve the actions; tickets go to the engineer.
5. **Verify fix**: post-repair data returns to baseline, the case closes as **Verified effective**.

## Built during the hackathon

Code and assets in this repository were created during the AI Builder Cup 2026 build window. Open-source libraries are used as declared dependencies (see `backend/requirements.txt` and `frontend/package.json`). The UI is inspired by the team's earlier prototype. Product inspiration and benchmark: `docs/BENCHMARK.md`.
