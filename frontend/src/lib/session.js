// Demo session stored in localStorage under `optiflow.session`:
//   {sandboxId, code, caseId, role, uid}
// A copy is also kept per role (`optiflow.session.manager`, `optiflow.session.engineer`)
// so a Manager tab and an Engineer tab in the same browser do not overwrite each other.
const KEY = 'optiflow.session';
const listeners = new Set();

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function roleFromPath(pathname = typeof window !== 'undefined' ? window.location.pathname : '/') {
  return pathname.startsWith('/e') ? 'engineer' : 'manager';
}

export function getSession(role) {
  if (role) return read(`${KEY}.${role}`) || (read(KEY)?.role === role ? read(KEY) : null);
  return read(`${KEY}.${roleFromPath()}`) || read(KEY);
}

export function saveSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
    if (session?.role) localStorage.setItem(`${KEY}.${session.role}`, JSON.stringify(session));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn(session));
}

export function clearSession(role) {
  try {
    if (role) localStorage.removeItem(`${KEY}.${role}`);
    else {
      localStorage.removeItem(KEY);
      localStorage.removeItem(`${KEY}.manager`);
      localStorage.removeItem(`${KEY}.engineer`);
    }
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(null));
}

export function onSessionChange(fn) {
  listeners.add(fn);
  const onStorage = (e) => {
    if (e.key && e.key.startsWith(KEY)) fn(getSession());
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

function rand4() {
  return Math.random().toString(36).slice(2, 6).padEnd(4, '0');
}

// Local-mode identity: `dev-<role>-<4 chars>`, stable per browser and role.
export function devUid(role) {
  const k = `optiflow.devUid.${role}`;
  try {
    let uid = localStorage.getItem(k);
    if (!uid) {
      uid = `dev-${role}-${rand4()}`;
      localStorage.setItem(k, uid);
    }
    return uid;
  } catch {
    return `dev-${role}-${rand4()}`;
  }
}
