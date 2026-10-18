# Optiflow LubeGuard: frontend

React 18 + Vite (JavaScript), Tailwind v3, react-router, framer-motion, lucide-react, recharts, react-hot-toast, Firebase (Auth, Firestore, Storage), cytoscape, qrcode.react, idb-keyval and vite-plugin-pwa.

- `/` landing page
- `/m` Manager console: Overview, `/m/case/:caseId` Incident Room, `/m/tickets`, `/m/graph`
- `/e` Engineer PWA: `/e/join`, `/e/tasks`, `/e/task/:ticketId`, `/e/capture`, `/e/alerts`

All plant data is synthetic. SITE SETPOINTS are not standards.

## Run modes

The mode is chosen at build time from env vars (see `src/lib/config.js`).

| Mode | When | Data |
|---|---|---|
| Fixtures | `VITE_USE_FIXTURES=true` | `/fixtures/*.json` in the browser; the Incident Room buttons walk case C-0412 through seed, open, evidence and verified. No backend needed. |
| Firebase | `VITE_FIREBASE_API_KEY` set | Anonymous sign-in, Firestore `onSnapshot` listeners on `sandboxes/{sid}/...`, Storage uploads, API calls with `Authorization: Bearer <ID token>` |
| Local | neither of the above | No Firebase. The API is polled every 2 s; identity is `X-Dev-Uid: dev-<role>-<4 chars>` (backend with `AUTH_MODE=off`) |

`npm run dev` and `npm run build` first run `scripts/copy-fixtures.mjs`, which copies `../fixtures/*.json` into `public/fixtures/` (gitignored).

### Fixtures mode (no backend)

```bash
cd frontend
npm install
VITE_USE_FIXTURES=true npm run dev          # PowerShell: $env:VITE_USE_FIXTURES="true"; npm run dev
```

Open http://localhost:5173, press "Enter as Manager", then "Run investigation", "Send evidence request" on Material. Open http://localhost:5173/e/join?code=7KQ2PX in a second tab (any code works in fixture mode), open the task, use "Use sample photo (hazy oil)". The Manager tab updates (state is shared through localStorage). Then "Approve selected" and "Verify fix". "Reset demo" in the role menu starts over.

### Local mode against the backend on port 8080

```bash
# terminal 1
cd backend && pip install -r requirements.txt
AI_MODE=cached STORE=memory AUTH_MODE=off uvicorn app.main:app --reload --port 8080

# terminal 2
cd frontend && npm install && npm run dev
```

Leave `VITE_API_BASE` empty: the Vite dev server proxies `/api` to `http://localhost:8080`. If you set `VITE_API_BASE=http://localhost:8080` instead, the backend must allow CORS from the dev origin.

### Firebase mode

Create `frontend/.env.local` (gitignored) with the public web config:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project>
VITE_FIREBASE_STORAGE_BUCKET=<project>.firebasestorage.app
VITE_FIREBASE_APP_ID=...
VITE_API_BASE=            # empty when the backend serves the built frontend (same origin)
```

Enable Anonymous sign-in in Firebase Authentication, and deploy the rules from the repo root: `firebase deploy --only firestore:rules,storage` (files `firestore.rules`, `storage.rules`).

## Environment variables

| Name | Default | Meaning |
|---|---|---|
| `VITE_API_BASE` | empty (same origin) | API base URL; routes are `${VITE_API_BASE}/api/...` |
| `VITE_USE_FIXTURES` | `false` | `true` runs the whole UI from fixtures |
| `VITE_FIREBASE_*` | empty | Firebase web config; enables Firebase mode when the API key is set |

## Build

```bash
npm run build      # output in frontend/dist (served by the backend container)
npm run preview    # serve the build locally on port 4173
npm run icons      # regenerate public/icons/*.png
```

## PWA install

The Engineer app is installable ("LubeGuard Engineer", start URL `/e`). The service worker (production build only) precaches the app shell and falls back to `index.html` for navigation, so the app opens offline after the first visit; `/api` is never cached.

- Android Chrome: open `/e/join?code=<code>` from the QR code, then menu, "Install app" (or "Add to Home screen").
- iOS Safari: Share, "Add to Home Screen".

Use the deployed HTTPS URL (or `localhost`); service workers and the camera need a secure origin.

## Offline test (DEV_PLAN section 7, steps 4 to 7)

1. Laptop: Manager console, "Run investigation", then "Send evidence request" on Material.
2. Phone: scan the QR code in the Manager header; the task "Oil sample photo from reservoir drain" appears in My Tasks.
3. Phone: open the task once while online (it is now cached), then switch on airplane mode.
4. Tick the checklist steps (pass, fail or N/A, with notes and readings), take the oil photo and record a voice note (or use the sample buttons). The banner shows "Offline: 2 items queued" and each item shows "Queued".
5. Switch airplane mode off. Items move to "Uploading" then "Synced" (retry runs on the `online` event, on app focus and every 15 s; failed items have a retry button).
6. Laptop: within 30 seconds Material flips to NG, the root cause appears and the skid path glows.

How it works: checklist progress goes to Firestore `sandboxes/{sid}/tickets/{tid}/progress/{stepId}` with the persistent local cache (synced by the SDK), or to `PUT /api/tickets/{tid}/progress/{stepId}` through the IndexedDB queue in local mode. Photos and voice notes are stored in IndexedDB (`src/lib/offlineQueue.js`), uploaded with `uploadBytes` to `sandboxes/{sid}/evidence/{ticketId}/{evidenceId}.{ext}`, then registered with `POST /api/evidence`; in local mode or if the upload fails, the media is sent inline as `dataBase64` plus `mimeType`. "Submit report" is queued the same way.

## Sample media

`public/samples/hazy_oil.svg` and `clear_oil.svg` are labelled illustrations used as thumbnails for the "Use sample photo" buttons (the request sends only `sample`). Replace them with real staged photos; see `public/samples/README.md`.
