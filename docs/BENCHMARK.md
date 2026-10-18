# Benchmark: Concorde Systems vs Proteus Guardian vs Optiflow (scope) vs Optiflow LubeGuard (proposed)

Written 2026-10-17. Inputs:
- **Concorde Systems:** public website (fetched 2026-10-17) and the team's competitor notes.
- **Proteus Guardian:** the team's earlier prototype, reviewed for design and UX patterns.
- **Optiflow (scope):** `scope-final-optiflow.md` in this repo, the team's source of truth.
- **Optiflow LubeGuard (proposed):** the niche decision (`docs/NICHE_DECISION.md`) plus this benchmark's carry-overs. Specified in `docs/PRD.md`. Source ids refer to `docs/SOURCES.md`.

Legend: **Yes** = described or built; **Partial** = thin or planned; **No** = absent; **n/s** = not stated on the public pages read.

## 1. Positioning

| | Concorde Systems | Proteus Guardian | Optiflow (scope) | **Optiflow LubeGuard** |
|---|---|---|---|---|
| One-line | "One knowledge graph for your whole plant" | Real-time machine monitoring, anomaly detection, RUL, and a Gemini chat copilot | "From signal to verified fix": closed-loop reliability across 15+ stages | "From signal to verified fix, for the oil that keeps your turbine alive" |
| Scope | General heavy industry (10 sectors) | Generic machine (dataset-driven) | General process plant (pump P-104 example) | **One system:** steam turbine lube-oil console, its pumps, bearings and auto-start circuit |
| Business model | 90-day free pilot (one department), enterprise via FOG engineers | Team prototype | Hackathon | Hackathon; pilot model borrowed from Concorde |
| Status | Commercial startup (Bandung) | Earlier team prototype | Planning docs (repo created 2026-10-17) | To be built fresh in the window |

## 2. Feature matrix

| Capability | Concorde | Proteus Guardian | Optiflow (scope) | **LubeGuard (proposed)** | Taken from |
|---|---|---|---|---|---|
| Roles | Plant owner, maintenance manager, reliability eng, manufacturing eng, C-level, technicians (marketing personas) | One role (Firebase login) | Personas (operator, technician, reliability eng, plant manager), no role-based app | **Two apps:** Manager web console and Engineer offline-first mobile app (plus approver permission) | Concorde (roles), user direction |
| Data ingestion | DECODER: PDFs, Excel, CAD, SCADA/ERP exports, photos, chat exports | Random simulator, AI4I 2020 CNC milling dataset | Simulator to Pub/Sub to Dataflow to BigQuery; SAP PM dummy | Lube-oil tag stream (replayed into BigQuery), lab oil results, auto-start test records, SOP documents parsed with Gemini | Optiflow + Concorde (document ingest) |
| Knowledge graph | **Core** (living graph linking files, assets, sensors, procedures) | No | Asset taxonomy lite (Stage 4); Spanner Graph mentioned | **Domain graph** of the lube-oil system: components, tags, failure modes, rules, SOP sections, incidents, work orders; interactive view; GraphRAG-lite Q&A | Concorde |
| AI assistant | ASSIST: graph traversal, cites nodes and documents, refuses with no sources, step-by-step field guidance | Gemini chat copilot with browser voice (id-ID STT and TTS); data picked by keyword routing, chat history ignored, image analysis broken (audit 5.4) | Agents with cited SOP/CAPA (S13) | "Ask LubeGuard": answers from graph neighbours with citations, refuses out of scope; Bahasa voice for engineers | Concorde (grounding, refusal), Proteus (voice) |
| Detection / prediction | HORIZON predictive warnings (method n/s) | Anomaly model on the public AI4I 2020 CNC milling dataset; RUL notebook is empty, RUL values are dummy (audit 5.3) | TimesFM + Vertex RUL (red team: replace) | TimesFM per signal in BigQuery, pressure-path classifier, time-to-threshold | Optiflow (red-team cut) |
| Root cause | Root-cause path traversal (demo panel) | Chat-based diagnosis | **4M+1E G/NG matrix with evidence** | 4M+1E matrix + lube-oil rules (R-T1 to R-T5, R-P1, R-P8) + circuit-aware readiness + evidence requests | Optiflow + niche |
| Work orders / tickets | **STATION:** create, assign, track; statuses Open, On Hold, In Progress, Done; due date, estimate, priority, assignees, attachments | "Most urgent action" card, in-memory tickets (not persisted), feedback form | S14 RACI auto-PIC, S15 Problem Tank (Open to Closed) | Tickets from cases or manual; RACI-suggested assignee; statuses; due date, priority, estimate; attached SOP sections | Concorde (WO model), Optiflow (case link, RACI, verification) |
| Preventive maintenance | PM schedules, calendar | No | No | Lube-oil PM templates: monthly auto-start test, monthly oil sample, filter changeover, cooler inspection (calendar view) | Concorde, niche |
| Checklists / inspections | Yes | No | SOP steps (S13) | SOP-derived checklists on the mobile app, each step citing SOP-LO section | Concorde + Optiflow |
| Parts inventory | Yes | No | Spare-part constraint in N2 (dummy) | Phase 2 (filter elements, cooler gaskets as a stub list) | Concorde |
| Field / mobile | Technician interface "as simple as a chat app"; field guidance | Responsive web | Mobile web field app (photo, voice) | **Offline-first PWA:** my tasks, checklist, photo/voice/gauge evidence, queue and sync, Bahasa | User direction, Optiflow N1 |
| Notifications | Integrations with Teams, Slack, Telegram, WhatsApp | Toasts | Google Chat webhook (cut in MVP) | In-app notification centre (Firestore); push via Firebase Cloud Messaging as P1 | Concorde (pattern) |
| Loss and economics | Cost per asset, downtime trend | No | **Live loss meter, intervention window** | Exposure, intervention window, KPI board | Optiflow |
| Reporting / KPIs | MTTR, MTBF, OEE, created vs completed, on time vs overdue, export PDF | PDF reports (jspdf) | Plant Overview | Manager KPI board (backlog, on-time %, MTTR, open cases, verified fixes) with PDF export as P1 | Concorde + Proteus |
| Verification / closure | n/s | Retrain control, feedback | **N3: closure only when data returns to baseline** | Same, plus write-back to the graph as a verified fix | Optiflow |
| Trust layer | Citations, refusal, data ownership, on-prem option | n/s | N6: citations, HITL, golden set | Citation validator, Unverified state, human approval, audit trail, eval with controls | Concorde + Optiflow |
| Landing / marketing | Polished site, product previews, personas, FAQ, engagement models | **Landing page, dark neon dashboard style, About, Docs** | n/a | Landing page in a Proteus-inspired visual language (re-implemented): hero, problem, how it works, roles, trust, CTA | Proteus (design), Concorde (content structure) |
| Deployment | Cloud, private cloud, on-prem, edge | Netlify, Railway, DigitalOcean, Docker Hub (none are Google Cloud) | Cloud Run / Agent Runtime | **Cloud Run** (API, agents, web) and Firebase (auth, hosting of PWA optional, messaging) | Rules |
| AI stack | NVIDIA NIM (CC1-003) | Gemini via google-generativeai, LangChain backup | ADK, "Gemini Pro" (outdated) | Gemini 3.8 Flash, ADK, BigQuery AI functions | Verified stack |
| Niche depth | General | Generic | General | **Deep: one system, tags, failure modes, rules, circuit** | Niche research |

## 3. What each source contributes

**From Concorde (best practice):**
1. Role separation: a planning and dispatch seat (manager) and a field seat (technician) on one data model.
2. Work-order model: statuses Open, On Hold, In Progress, Done; assignee, due date, estimate, priority, attachments; reschedule; PM calendar; checklists and inspections.
3. Grounded assistant: answers come from the graph, cite nodes and documents, and refuse when nothing matches ("0 sources, answer refused").
4. Knowledge graph as the single source of truth that every module reads.
5. Leadership reporting: created vs completed, on time vs overdue, MTTR/MTBF, cost per asset, export.
6. Adoption pattern: start with one department, prove value on the customer's own data, then scale.

**From Proteus Guardian (design reference):**
1. Dark industrial visual language (navy surfaces, purple and cyan accents, neon glow, status colours), re-created as design tokens.
2. Landing page anatomy and dashboard composition.
3. Schematic view of a machine on the dashboard (re-imagined as the lube-oil system diagram with live tags).
4. Voice chat (speech in, speech out) for the copilot, re-done for Bahasa engineer input.
5. PDF report export pattern.

**From Optiflow (source of truth for the engine):**
1. Case-centric design: every module enriches one Case.
2. Numbers by code, reasoning by Gemini.
3. 4M+1E G/NG matrix with "Unverified" and evidence requests.
4. Loss meter, intervention window, data-verified closure.
5. Trust layer: citations, approval, golden-set eval.

**From the niche research:** one deeply modelled system (steam turbine lube-oil console): tag list, failure-mode library F1 to F12, rules R-T1 to R-T5, R-P1, R-P8, R4, the auto-start circuit, the "hazy oil" hero scenario, and the UCI real-rig backtest.

## 4. Gaps each product leaves (and how LubeGuard answers)

| Gap | Concorde | Proteus Guardian | Optiflow (scope) | LubeGuard answer |
|---|---|---|---|---|
| Generic, so root causes stay vague | Yes (general graph) | Yes (generic dataset) | Partly (general plant) | One system with standards-based rules |
| No closed loop to verified fix | n/s | Yes | No (has N3) | Closure on sensor proof |
| No offline field app | n/s | Yes | Partly | Offline-first PWA |
| No work-order workflow | No (has STATION) | Yes | Partly | Tickets, assignment, statuses, PM |
| No grounded, refusing assistant | No (has ASSIST) | Yes | Partly | Graph-grounded answers with refusal |
| Not on Google Cloud | Unknown | Yes (DigitalOcean/Netlify) | No | Cloud Run + Firebase |
| Scope too big for 24 hours | n/a | n/a | **Yes** | Phased PRD with an R0 hackathon cut |

