// API client for every endpoint in contracts/api.md.
// Firebase mode sends `Authorization: Bearer <ID token>`; local mode sends `X-Dev-Uid`.
// Fixture mode routes the same calls to the in-browser fixture backend.
import { API_BASE, MODE } from './config';
import { getIdToken, currentUid } from './firebase';
import { getSession, saveSession, roleFromPath, devUid } from './session';
import * as fx from './fixtureBackend';

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function headers(role) {
  const h = { 'Content-Type': 'application/json' };
  if (MODE === 'firebase') {
    const token = await getIdToken();
    if (token) h.Authorization = `Bearer ${token}`;
  } else {
    const r = role || roleFromPath();
    h['X-Dev-Uid'] = getSession(r)?.uid || devUid(r);
  }
  return h;
}

async function request(method, path, body, { role, timeoutMs = 45000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: await headers(role),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg = (data && (data.detail?.message || data.detail || data.message)) || `${res.status} ${res.statusText}`;
      throw new ApiError(typeof msg === 'string' ? msg : JSON.stringify(msg), res.status, data);
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiError('Request timed out', 0);
    if (err instanceof ApiError) throw err;
    throw new ApiError(navigator.onLine ? `Network error: ${err.message}` : 'You are offline', 0);
  } finally {
    clearTimeout(timer);
  }
}

const q = (params) =>
  '?' +
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

const enc = encodeURIComponent;
const FX = MODE === 'fixtures';

async function identityFor(role) {
  if (MODE === 'firebase') return (await currentUid()) || `anon-${role}`;
  if (MODE === 'local') return devUid(role);
  return `fixture-${role}`;
}

// ---------- demo sessions ----------

export async function health() {
  if (FX) return fx.health();
  return request('GET', '/health');
}

export async function createSession(role = 'manager') {
  const res = FX ? await fx.createSession(role) : await request('POST', '/demo/session', { role }, { role });
  const session = { sandboxId: res.sandboxId, code: res.code, caseId: res.caseId, role: res.role || role, uid: await identityFor(role) };
  saveSession(session);
  return session;
}

export async function joinSandbox(code) {
  const clean = String(code || '').trim().toUpperCase();
  const res = FX ? await fx.joinSandbox(clean) : await request('POST', '/demo/join', { code: clean }, { role: 'engineer' });
  const session = { sandboxId: res.sandboxId, code: res.code || clean, caseId: res.caseId, role: 'engineer', uid: await identityFor('engineer') };
  saveSession(session);
  return session;
}

export async function resetDemo(sandboxId) {
  if (FX) return fx.resetDemo();
  return request('POST', '/demo/reset', { sandboxId });
}

// ---------- cases ----------

export async function getCase(caseId, sandboxId) {
  if (FX) return fx.getCase();
  return request('GET', `/cases/${enc(caseId)}${q({ sandboxId })}`);
}

export async function investigate(caseId, sandboxId) {
  if (FX) return fx.investigate();
  return request('POST', `/cases/${enc(caseId)}/investigate`, { sandboxId }, { timeoutMs: 90000 });
}

export async function requestEvidence(caseId, sandboxId, category = 'material') {
  if (FX) return fx.requestEvidence(caseId, sandboxId, category);
  return request('POST', `/cases/${enc(caseId)}/evidence-request`, { sandboxId, category });
}

export async function approve(caseId, sandboxId, actionIds) {
  if (FX) return fx.approve(caseId, sandboxId, actionIds);
  return request('POST', `/cases/${enc(caseId)}/approve`, { sandboxId, actionIds });
}

export async function verify(caseId, sandboxId) {
  if (FX) return fx.verify();
  return request('POST', `/cases/${enc(caseId)}/verify`, { sandboxId }, { timeoutMs: 60000 });
}

// ---------- evidence ----------

// body: {sandboxId, ticketId, caseId, kind, storagePath, note?, sample?, dataBase64?, mimeType?}
export async function postEvidence(body) {
  if (FX) return fx.postEvidence(body);
  return request('POST', '/evidence', body, { role: 'engineer', timeoutMs: 60000 });
}

// ---------- tickets ----------

export async function getTickets(sandboxId, role) {
  if (FX) return fx.getTickets(sandboxId, role);
  return request('GET', `/tickets${q({ sandboxId, role })}`);
}

export async function createTicket(body) {
  if (FX) return fx.createTicket(body);
  return request('POST', '/tickets', body);
}

export async function patchTicket(ticketId, body) {
  if (FX) return fx.patchTicket(ticketId, body);
  return request('PATCH', `/tickets/${enc(ticketId)}`, body);
}

export async function getProgress(ticketId, sandboxId) {
  if (FX) return fx.getProgress(ticketId);
  return request('GET', `/tickets/${enc(ticketId)}/progress${q({ sandboxId })}`);
}

export async function putProgress(ticketId, stepId, body) {
  if (FX) return fx.putProgress(ticketId, stepId, body);
  return request('PUT', `/tickets/${enc(ticketId)}/progress/${enc(stepId)}`, body, { role: 'engineer' });
}

export async function completeTicket(ticketId, sandboxId, report) {
  if (FX) return fx.completeTicket(ticketId, sandboxId, report);
  return request('POST', `/tickets/${enc(ticketId)}/complete`, { sandboxId, report }, { role: 'engineer' });
}

// ---------- knowledge graph and Ask ----------

export async function getKg(sandboxId, caseId) {
  if (FX) return fx.getKg();
  return request('GET', `/kg${q({ sandboxId, caseId })}`);
}

export async function ask(sandboxId, question, caseId) {
  if (FX) return fx.ask(sandboxId, question, caseId);
  return request('POST', '/ask', { sandboxId, question, caseId }, { timeoutMs: 30000 });
}

// ---------- notifications ----------

export async function getNotifications(sandboxId, role) {
  if (FX) return fx.getNotifications(sandboxId, role);
  return request('GET', `/notifications${q({ sandboxId, role })}`);
}

export async function markNotificationRead(id, sandboxId) {
  if (FX) return fx.markNotificationRead(id);
  return request('POST', `/notifications/${enc(id)}/read`, { sandboxId });
}
