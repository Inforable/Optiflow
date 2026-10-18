# API contract (R0)

Source of truth for shapes: `backend/app/models.py` (exported as `contracts/case.schema.json`). Examples: `fixtures/`.
All routes are JSON under `/api`. Every route except `GET /api/health` expects `Authorization: Bearer <Firebase ID token>` (skipped when the backend runs with `AUTH_MODE=off` for local development).

| Method and path | Request body | Response | Side effects |
|---|---|---|---|
| `GET /api/health` | | `{ok, version, aiMode, store}` | |
| `POST /api/demo/session` | `SessionRequest {role: "manager"}` | `SessionResponse {sandboxId, code, caseId, role}` | Creates sandbox `sbx_<8>` with a 6-character join code; seeds case C-0412 from `fixtures/case_C0412_seed.json`, a `case_opened` notification for the manager |
| `POST /api/demo/join` | `JoinRequest {code}` | `SessionResponse` (role `engineer`) | Adds the caller as engineer member |
| `POST /api/demo/reset` | `SandboxRequest {sandboxId}` | `{ok: true}` | Re-seeds the sandbox (case, tickets, evidence, notifications) |
| `GET /api/cases/{caseId}?sandboxId=` | | `Case` | |
| `POST /api/cases/{caseId}/investigate` | `SandboxRequest` | `Case` (status `awaiting_evidence`) | Appends `trace` entries one by one while tools run (clients see them live); writes the Case |
| `POST /api/cases/{caseId}/evidence-request` | `EvidenceRequestBody {sandboxId, category}` | `Ticket` (type `evidence_request`) | Links the ticket to `diagnosis.evidenceRequests[].ticketId`; notification to engineer |
| `POST /api/evidence` | `EvidenceUpload {sandboxId, ticketId, caseId, kind, storagePath, note?, sample?}` | `Evidence` (with `judged`) | Judges with Gemini (or the sample's canned judgement in cached mode); re-structures the matrix; sets root cause and Advisor actions; Case status `action_proposed`; notification to manager. `sample` is `hazy_oil`, `clear_oil` or `voice_hazy` for the "Use sample" buttons; `dataBase64` + `mimeType` carry the media directly in local mode or when the Storage upload fails |
| `POST /api/cases/{caseId}/approve` | `ApproveRequest {sandboxId, actionIds}` | `{tickets: Ticket[]}` | One ticket per action (RACI assignee); Case status `actions_approved`; notifications |
| `GET /api/tickets?sandboxId=&role=` | | `Ticket[]` | Optional `role` filter (`engineer`) |
| `POST /api/tickets` | `Ticket` minus `id`, `createdAt` plus `sandboxId` | `Ticket` | Manual ticket (createdBy `human`) |
| `PATCH /api/tickets/{ticketId}` | `{sandboxId, status?, assigneeRole?, assigneeName?}` | `Ticket` | Notification to new assignee |
| `GET /api/tickets/{ticketId}/progress?sandboxId=` | | `Progress[]` | Local-mode fallback (production clients read Firestore) |
| `PUT /api/tickets/{ticketId}/progress/{stepId}` | `ProgressUpdate {sandboxId, done, result?, note?, reading?}` | `Progress` | Local-mode fallback (production clients write Firestore directly, offline-safe) |
| `POST /api/tickets/{ticketId}/complete` | `CompleteRequest {sandboxId, report}` | `Ticket` (status `done`) | Notification to manager |
| `POST /api/cases/{caseId}/verify` | `SandboxRequest` | `Case` | Appends replayed post-repair readings; runs baseline checks; status `verified` or `reopened`; writes a verified incident into the sandbox graph |
| `GET /api/kg?sandboxId=&caseId=` | | `KgGraph {nodes, edges, highlight}` | `highlight` = root-cause path when known |
| `POST /api/ask` | `AskRequest {sandboxId, question, caseId?}` | `AskResponse {answer, citations, refused}` | Refuses with "0 sources, answer refused" when retrieval is empty or out of scope |
| `GET /api/notifications?sandboxId=&role=` | | `Notification[]` | Fallback for clients without Firestore listeners |
| `POST /api/notifications/{id}/read` | `SandboxRequest` | `{ok: true}` | |

Local development identity: with `AUTH_MODE=off` the backend reads `X-Dev-Uid` (for example `dev-manager-1a2b`) instead of a Firebase token.

Backend modes (env): `AI_MODE=live|cached` (cached returns fixture states and canned judgements, no Gemini calls; also the automatic fallback when a live call fails or exceeds 25 s, with `audit.cached = true`), `STORE=firestore|memory` (memory for local development without GCP).
