// Runtime mode, decided once from Vite env vars.
//   fixtures: VITE_USE_FIXTURES=true, everything runs in the browser from /fixtures/*.json
//   firebase: VITE_FIREBASE_API_KEY set, live Firestore listeners plus the API
//   local:    no Firebase, the API is polled every 2 s and identity is X-Dev-Uid
const env = import.meta.env;

export const USE_FIXTURES = String(env.VITE_USE_FIXTURES || '').toLowerCase() === 'true';
export const FIREBASE_ENABLED = !USE_FIXTURES && Boolean(env.VITE_FIREBASE_API_KEY);
export const MODE = USE_FIXTURES ? 'fixtures' : FIREBASE_ENABLED ? 'firebase' : 'local';
export const API_BASE = (env.VITE_API_BASE || '').replace(/\/$/, '');
export const POLL_MS = 2000;
export const REPO_URL = 'https://github.com/Inforable/Optiflow';
export const DEFAULT_CASE_ID = 'C-0412';

export const MODE_LABEL = {
  fixtures: 'Fixture mode',
  firebase: 'Live',
  local: 'Local API',
}[MODE];
