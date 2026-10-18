# Deploy guide: Optiflow LubeGuard on Google Cloud

One Cloud Run service (`optiflow`) serves the API, the agents and the built web app (landing, Manager console, Engineer PWA). Firebase provides Auth (anonymous), Firestore and Storage on the same Google Cloud project. Gemini is called with an AI Studio key stored in Secret Manager.

Time needed: about 30 to 45 minutes the first time.

## 1. Project and APIs

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  bigquery.googleapis.com firestore.googleapis.com storage.googleapis.com \
  secretmanager.googleapis.com aiplatform.googleapis.com firebase.googleapis.com
```

Billing must be linked (Gemini Tier 1, Cloud Run, Storage).

## 2. Firebase (console)

1. https://console.firebase.google.com: Add project, choose the **existing** Google Cloud project.
2. Build, Authentication: enable **Anonymous** sign-in.
3. Build, Firestore Database: create in **Native mode**, location `asia-southeast2` (Jakarta).
4. Build, Storage: create the default bucket (note its name, for example `YOUR_PROJECT_ID.firebasestorage.app`).
5. Project settings, Your apps: add a **Web app**; copy the config values (apiKey, authDomain, projectId, storageBucket, appId).
6. Deploy the security rules from the repo root (needs the Firebase CLI: `npm i -g firebase-tools`):
   ```bash
   firebase login
   firebase use YOUR_PROJECT_ID
   firebase deploy --only firestore:rules,storage
   ```
   (If you prefer, paste `firestore.rules` and `storage.rules` into the console Rules tabs instead.)

## 3. Gemini key in Secret Manager

Create a key in Google AI Studio on the billing-linked project, then:

```bash
printf "%s" "YOUR_GEMINI_KEY" | gcloud secrets create GEMINI_API_KEY --data-file=-
```

## 4. BigQuery (anomaly detection)

```bash
bq mk --location=US lube
cd backend && python -m venv .venv && . .venv/Scripts/activate  # Windows Git Bash; use .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
python scripts/generate_data.py          # regenerates the 1-minute CSVs (gitignored)
python scripts/load_bigquery.py --project YOUR_PROJECT_ID --dataset lube
bq query --use_legacy_sql=false < scripts/detect_anomalies.sql   # sanity check
```

If `AI.DETECT_ANOMALIES` is not available, the backend falls back to the precomputed `backend/data/generated/anomalies_hero.json` automatically.

## 5. Service account permissions

```bash
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for ROLE in roles/datastore.user roles/bigquery.user roles/bigquery.dataViewer roles/storage.objectAdmin \
            roles/secretmanager.secretAccessor roles/firebaseauth.viewer; do
  gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member="serviceAccount:${SA}" --role="${ROLE}"
done
```

## 6. Build-time web config

The web app reads the Firebase config at build time. Create `frontend/.env.production` (public values; safe to commit or keep local):

```
VITE_API_BASE=
VITE_USE_FIXTURES=false
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT_ID.firebasestorage.app
VITE_FIREBASE_APP_ID=...
```

## 7. Deploy to Cloud Run

From the repo root (the Dockerfile builds the frontend and the backend together):

```bash
gcloud run deploy optiflow --source . --region asia-southeast2 --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --set-env-vars GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,BQ_DATASET=lube,STORAGE_BUCKET=YOUR_PROJECT_ID.firebasestorage.app,AI_MODE=live,STORE=firestore,AUTH_MODE=firebase,GEMINI_MODEL=gemini-3.8-flash \
  --timeout 300 --memory 1Gi
```

Then add the Cloud Run URL to Firebase Authentication, Settings, **Authorized domains**.

## 8. Judging window hardening

```bash
gcloud run services update optiflow --region asia-southeast2 --min-instances 1
```

Also set a budget alert in Billing and check the Gemini Tier 1 limits in AI Studio.

## 9. Smoke test

```bash
curl https://YOUR_SERVICE_URL/api/health
```

Then follow `docs/DEV_PLAN.md` section 7 (laptop as Manager, phone as Engineer via the QR code, offline capture, verify). Run the eval:

```bash
python backend/scripts/eval.py --base-url https://YOUR_SERVICE_URL
```

(With `AUTH_MODE=firebase` the eval needs a token; simplest is to run it against a local backend with `AUTH_MODE=off`, see `backend/README.md`.)

## Troubleshooting

| Symptom | Fix |
|---|---|
| 403 on Firestore from the browser | Rules not deployed, or the user is not a sandbox member (join again) |
| Anonymous sign-in fails on the Cloud Run URL | Add the domain to Firebase Auth authorized domains |
| Agent steps show "cached result" | Gemini call failed or exceeded 25 s; check the key secret and quota |
| Uploads stay "queued" | Storage rules or bucket name; the app falls back to sending the photo inline |
| Cold start delay | `--min-instances 1` |
