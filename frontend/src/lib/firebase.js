// Firebase is initialised only when VITE_FIREBASE_API_KEY is set (and fixture mode is off).
// Otherwise the app runs in local mode with no Firebase at all.
import { FIREBASE_ENABLED } from './config';

let app = null;
let auth = null;
let db = null;
let storage = null;
let readyPromise = null;

export const firebaseEnabled = FIREBASE_ENABLED;

async function init() {
  const [{ initializeApp }, authMod, fsMod, stMod] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
    import('firebase/storage'),
  ]);
  const env = import.meta.env;
  app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  auth = authMod.getAuth(app);
  try {
    db = fsMod.initializeFirestore(app, {
      localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.warn('Firestore persistent cache unavailable, using memory cache', err);
    db = fsMod.getFirestore(app);
  }
  storage = stMod.getStorage(app);

  await new Promise((resolve) => {
    const unsub = authMod.onAuthStateChanged(auth, async (user) => {
      if (user) {
        unsub();
        resolve(user);
        return;
      }
      try {
        await authMod.signInAnonymously(auth);
      } catch (err) {
        console.warn('Anonymous sign-in failed (offline?)', err);
        unsub();
        resolve(null);
      }
    });
  });
  return { app, auth, db, storage };
}

// Resolves to {app, auth, db, storage} or null in local and fixture mode.
export function firebaseReady() {
  if (!FIREBASE_ENABLED) return Promise.resolve(null);
  if (!readyPromise) readyPromise = init();
  return readyPromise;
}

export async function getIdToken() {
  const fb = await firebaseReady();
  if (!fb?.auth?.currentUser) return null;
  try {
    return await fb.auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

export async function currentUid() {
  const fb = await firebaseReady();
  return fb?.auth?.currentUser?.uid || null;
}
