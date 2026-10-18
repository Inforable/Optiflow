// Data hooks: useCase, useTickets, useNotifications, useProgress, useKg, plus small helpers.
// Each works in the three modes described in hooks/live.js.
import { useEffect, useState } from 'react';
import * as api from '../lib/api';
import { getSession, onSessionChange } from '../lib/session';
import { subscribeQueue } from '../lib/offlineQueue';
import { useLive } from './live';

export { refreshNow } from './live';

export function useSession(role) {
  const [session, setSession] = useState(() => getSession(role));
  useEffect(() => onSessionChange(() => setSession(getSession(role))), [role]);
  return session;
}

export function useCase(caseId, session) {
  const sid = session?.sandboxId;
  return useLive({
    enabled: Boolean(caseId && sid),
    deps: [caseId, sid],
    fetcher: () => api.getCase(caseId, sid),
    listen: (fs, db, onData, onError) =>
      fs.onSnapshot(fs.doc(db, 'sandboxes', sid, 'cases', caseId), (snap) => onData(snap.exists() ? snap.data() : null), onError),
  });
}

const byCreated = (a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''));

// role "engineer" limits the list to tickets assigned to the engineer
export function useTickets(session, role) {
  const sid = session?.sandboxId;
  const res = useLive({
    enabled: Boolean(sid),
    deps: [sid, role],
    fetcher: () => api.getTickets(sid, role),
    listen: (fs, db, onData, onError) => {
      const col = fs.collection(db, 'sandboxes', sid, 'tickets');
      const qy = role === 'engineer' ? fs.query(col, fs.where('assigneeRole', '==', 'engineer')) : col;
      return fs.onSnapshot(qy, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
    },
  });
  return { ...res, data: res.data ? [...res.data].sort(byCreated) : res.data };
}

const byAtDesc = (a, b) => String(b.at || '').localeCompare(String(a.at || ''));

export function useNotifications(session, role) {
  const sid = session?.sandboxId;
  const res = useLive({
    enabled: Boolean(sid && role),
    deps: [sid, role],
    fetcher: () => api.getNotifications(sid, role),
    listen: (fs, db, onData, onError) =>
      fs.onSnapshot(
        fs.query(fs.collection(db, 'sandboxes', sid, 'notifications'), fs.where('toRole', '==', role)),
        (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        onError,
      ),
  });
  const list = res.data ? [...res.data].sort(byAtDesc) : [];
  return { ...res, data: list, unread: list.filter((n) => !n.read).length };
}

// Returns {data: {[stepId]: Progress}}
export function useProgress(session, ticketId) {
  const sid = session?.sandboxId;
  const res = useLive({
    enabled: Boolean(sid && ticketId),
    deps: [sid, ticketId],
    fetcher: async () => {
      const list = await api.getProgress(ticketId, sid);
      return Object.fromEntries((list || []).map((p) => [p.stepId, p]));
    },
    listen: (fs, db, onData, onError) =>
      fs.onSnapshot(
        fs.collection(db, 'sandboxes', sid, 'tickets', ticketId, 'progress'),
        { includeMetadataChanges: true },
        (snap) => onData(Object.fromEntries(snap.docs.map((d) => [d.id, { stepId: d.id, ...d.data(), pending: d.metadata.hasPendingWrites }]))),
        onError,
      ),
  });
  return { ...res, data: res.data || {} };
}

// Knowledge graph from GET /api/kg (fixture file in fixture mode); refetched when the case status changes.
export function useKg(session, caseId, caseStatus) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const sid = session?.sandboxId;
  useEffect(() => {
    let alive = true;
    if (!sid) return undefined;
    api
      .getKg(sid, caseId)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState((s) => ({ ...s, error, loading: false })));
    return () => {
      alive = false;
    };
  }, [sid, caseId, caseStatus]);
  return state;
}

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useQueue() {
  const [items, setItems] = useState([]);
  useEffect(() => subscribeQueue(setItems), []);
  const pending = items.filter((i) => i.state !== 'synced');
  return { items, pending, pendingCount: pending.length, failedCount: items.filter((i) => i.state === 'failed').length };
}
