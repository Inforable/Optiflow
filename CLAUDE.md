# CLAUDE.md: Optiflow LubeGuard

Shared context for every Claude Code session in this repo. Read it before any task.

## What we are building
**Optiflow LubeGuard**: reliability intelligence for **steam turbine lube-oil systems**, for the Google Cloud AI Builder Cup 2026 (theme: Manufacturing: Intelligent Operations & Industrial Efficiency). Two roles: a **Manager web console** (Incident Room, tickets, notifications, knowledge graph, grounded Ask) and an **offline-first Engineer PWA** (tasks, SOP checklists, photo and voice evidence). Engine: detect, diagnose with a 4M+1E matrix (Good / Not Good / Unverified with citations), request evidence, advise, approve, verify on sensor data.

Specs, in order of authority:
1. `docs/DEV_PLAN.md`: who builds what, contracts, timeline, prompts
2. `contracts/` and `fixtures/`: the data shapes (law after checkpoint CP0)
3. `docs/PRD.md`: product requirements (IDs like MGR-02, ENG-05, AI-04)
4. `docs/NICHE_DECISION.md`: domain truth (tags, failure modes, rules, auto-start circuit, hero scenario)

## Non-negotiable rules
- **Fresh code only:** everything is written in this repo during the hackathon. Do not fork or vendor other repos; use libraries as declared dependencies. The team's earlier prototype (Proteus Guardian) is a visual reference only.
- **Google only in the deployed path:** Gemini, ADK, Cloud Run, BigQuery, Firestore, Firebase Auth, Cloud Storage. No OpenAI, Vercel, Netlify, Supabase, Pinecone, etc.
- **Models:** `gemini-3.8-flash` everywhere (read from `GEMINI_MODEL`). Do not use "Gemini Pro", Gemini 2.x, 3.5 Flash or 3.7 Flash. Vertex AI is now "Gemini Enterprise Agent Platform"; Vertex AI Search is now "Agent Search".
- **Numbers by code, reasoning by Gemini:** rule verdicts, loss, exposure, thresholds and verification are deterministic Python or SQL. Gemini never invents numbers.
- **Citations are validated in code:** any verdict citing a rule id, SOP section or evidence id that does not exist is downgraded to UNVERIFIED.
- **Grounded or silent:** Ask answers only from retrieved graph nodes and SOP sections; otherwise `refused: true` with "0 sources, answer refused".
- **Honest data:** all plant data is synthetic; label it. Setpoints are "SITE SETPOINT (synthetic)", not standards.
- **English** for code, comments, docs and UI default (Bahasa is a UI toggle and voice input feature).
- **No secrets in git.** Firebase web config is public; the Gemini key is in Secret Manager or `.env` (gitignored).
- **No em dashes** in docs and UI copy.

## Ownership (do not edit outside your folders without agreement)
- **Dev A:** `backend/`, `contracts/`, `fixtures/`, `Dockerfile`
- **Dev B:** `frontend/`, `firestore.rules`, `storage.rules`
- **Shared:** `README.md`, `CLAUDE.md`, `.env.example`, `docs/` (read-only during the build)

## Domain cheat sheet (details in docs/NICHE_DECISION.md)
- System LO-01 for steam turbine ST-01: reservoir (LT-101), P-104A main AC pump (IT-104A, VT-104A), P-104B standby AC pump, P-105 DC emergency pump, duplex filter F-101A/B (PDT-101), duplex cooler E-101A/B (TT-102), PCV-101, header (PT-104), journal bearings (TE-201, TE-202), thrust bearing (TE-203/204, ZT-205).
- Auto-start logic: PSL-104 below 1.2 barg starts P-104B; PSLL-104 below 0.8 barg starts P-105 and trips the turbine (SITE SETPOINTS).
- Hero case C-0412: cooler E-101A leaks water into the oil; filter loads; PT-104 falls 1.6 to 1.3 barg over 5 days while the alarm stays green. Material is UNVERIFIED until the engineer's oil photo shows hazy oil ("clear and bright" check), then NG; Method NG because the auto-start test is 47 days old vs a 30-day SOP interval.
- Rules: R-T1 oil limits, R-T2 ISO 4406, R-T3 bearing temperature, R-T4 auto-start readiness, R-T5 pressure-path classifier, R-P1 pump vibration (ISO 10816-7), R-P8 motor overheating logic, R4 voltage unbalance. Sources in `docs/SOURCES.md`.
- Cost: US$29,721 per downtime hour (problem brief: US$67.2M / 2,261 h). Show the formula.

## Design tokens (Proteus Guardian style, re-created here)
- Neutrals: `dark-950 #07090D`, `dark-900 #0B0E14` (page), `dark-800 #151A23` (cards, sidebar), `dark-700 #232D3F` (borders), `dark-600 #2E3A50`, `dark-500 #3D4A63`. Define the whole ramp.
- Primary: cyan `#06B6D4`, glow `0 0 15px rgba(6,182,212,0.3)` on primary actions only. AI: purple `#8B5CF6`. Status: success `#10B981` (G), warning `#F59E0B` (UNVERIFIED), danger `#EF4444` (NG); always pair colour with an icon.
- Pills: `text-{c}-400 bg-{c}-900/20 border border-{c}-900/30`. Provenance chip: Human (blue, user icon) vs AI (purple, bot icon).
- Type: Inter (UI), JetBrains Mono (tags, values, ids); 10 px uppercase micro labels; bold headings. Radius 8 (inputs, chips), 12 (cards), 16 (modals), full (pills). Glass: `bg-dark-900/80 backdrop-blur-md`.
- Libraries: lucide-react, framer-motion, recharts, react-hot-toast.

## Commands
- Backend local: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8080`
- Frontend local: `cd frontend && npm install && npm run dev` (set `VITE_API_BASE=http://localhost:8080`, `VITE_USE_FIXTURES=true` until CP1)
- Deploy (Dev A): `gcloud run deploy optiflow --source . --region asia-southeast2 --allow-unauthenticated --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest --timeout 300`
- Eval: `python backend/scripts/eval.py --base-url <cloud run url>`

## Working style
- Small commits, `git pull --rebase` before push, conventional prefixes (`feat(backend):`, `feat(frontend):`, `fix:`).
- If a contract must change, stop and say so; Dev A updates `contracts/` and `fixtures/` together.
- Prefer the fallback in DEV_PLAN section 8 over long debugging.
