# Firestore and Storage contract (R0)

All operational data lives under one sandbox per demo session: `sandboxes/{sid}`.

| Path | Writer | Reader | Shape |
|---|---|---|---|
| `sandboxes/{sid}` | backend | members | `{code, createdAt, caseId, members: {uid: "manager" or "engineer"}, names: {manager, engineer}}` |
| `sandboxes/{sid}/cases/{caseId}` | backend | members | `Case` (`backend/app/models.py`) |
| `sandboxes/{sid}/tickets/{ticketId}` | backend | members | `Ticket` |
| `sandboxes/{sid}/tickets/{ticketId}/progress/{stepId}` | **engineer client** (offline-safe) | members | `{done: bool, result: "pass" or "fail" or "na", note, reading, by, at}` |
| `sandboxes/{sid}/evidence/{evidenceId}` | backend | members | `Evidence` |
| `sandboxes/{sid}/notifications/{nid}` | backend | members | `Notification` |
| `codes/{code}` | backend | backend | `{sandboxId}` (join-code lookup) |

Rules (Dev B, `firestore.rules`): a signed-in user can read anything under `sandboxes/{sid}` if `request.auth.uid` is a key of `sandboxes/{sid}.members`; can write only `tickets/{tid}/progress/{stepId}`. All other writes come from the backend (Admin SDK bypasses rules). `codes/*`: no client access.

Storage (`storage.rules`): `sandboxes/{sid}/evidence/{ticketId}/{file}`: members may write images (`image/*`, max 10 MB) and audio (`audio/*`, max 10 MB); members may read. Membership is checked with `firestore.get()` on the sandbox doc.

Client offline behaviour: Firestore web SDK with `persistentLocalCache({tabManager: persistentMultipleTabManager()})`; progress writes queue offline and sync automatically. Media blobs are queued in IndexedDB and uploaded with `uploadBytes` when online, then `POST /api/evidence` is called.
