// Offline queue for the Engineer app.
// Every evidence item (blob plus metadata), local-mode progress write and report
// submission is stored in IndexedDB (idb-keyval) first, then sent when online.
//   evidence, Firebase mode: uploadBytes to sandboxes/{sid}/evidence/{ticketId}/{evidenceId}.{ext},
//                            then POST /api/evidence with storagePath
//   evidence, local mode or upload failure: POST /api/evidence with dataBase64 + mimeType
// Retries on `online`, window focus, visibility change and a slow timer.
// Item states: queued, uploading, synced, failed.
import { createStore, get, set, del, entries } from 'idb-keyval';
import { MODE } from './config';
import { firebaseReady } from './firebase';
import * as api from './api';

const store = createStore('optiflow-queue', 'items');
const listeners = new Set();
let items = [];
let loaded = false;
let processing = false;
let memoryOnly = false;

function emit() {
  const snapshot = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  listeners.forEach((fn) => fn(snapshot));
}

async function persist(item) {
  if (memoryOnly) return;
  try {
    await set(item.id, item, store);
  } catch (err) {
    console.warn('IndexedDB unavailable, queue kept in memory only', err);
    memoryOnly = true;
  }
}

async function loadAll() {
  if (loaded) return;
  loaded = true;
  try {
    const all = await entries(store);
    items = all.map(([, v]) => v);
    // An item left "uploading" by a closed tab goes back to queued.
    for (const it of items) {
      if (it.state === 'uploading') {
        it.state = 'queued';
        await persist(it);
      }
    }
    // Drop synced items older than 12 hours.
    const cutoff = Date.now() - 12 * 3600 * 1000;
    for (const it of items.filter((i) => i.state === 'synced' && Date.parse(i.syncedAt || i.createdAt) < cutoff)) {
      await del(it.id, store);
    }
    items = items.filter((i) => !(i.state === 'synced' && Date.parse(i.syncedAt || i.createdAt) < cutoff));
  } catch (err) {
    console.warn('IndexedDB read failed', err);
    memoryOnly = true;
  }
  emit();
}

async function patch(id, changes) {
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  items[idx] = { ...items[idx], ...changes };
  await persist(items[idx]);
  emit();
  return items[idx];
}

function randomId(prefix) {
  const rnd = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^a-z0-9]/gi, '').slice(0, 10);
  return `${prefix}_${rnd}`;
}

export function extFor(mimeType = '', kind = 'photo') {
  const m = mimeType.toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('heic')) return 'heic';
  if (m.includes('webm')) return 'webm';
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'm4a';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('wav')) return 'wav';
  if (m.includes('svg')) return 'svg';
  return kind === 'voice' ? 'webm' : 'jpg';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// ---------- public API ----------

export function subscribeQueue(fn) {
  listeners.add(fn);
  loadAll().then(() => fn([...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))));
  return () => listeners.delete(fn);
}

export function getQueue() {
  return [...items];
}

// meta: {sandboxId, caseId, ticketId, kind, note?, sample?, stepId?, label?}
export async function enqueueEvidence(meta, blob) {
  await loadAll();
  const evidenceId = randomId('ev');
  const mimeType = blob?.type || (meta.kind === 'voice' ? 'audio/webm' : 'image/jpeg');
  const ext = extFor(mimeType, meta.kind);
  const storagePath = meta.sample
    ? `samples/${meta.sample}.${meta.sample === 'voice_hazy' ? 'webm' : 'jpg'}`
    : `sandboxes/${meta.sandboxId}/evidence/${meta.ticketId}/${evidenceId}.${ext}`;
  const item = {
    id: evidenceId,
    type: 'evidence',
    state: 'queued',
    createdAt: new Date().toISOString(),
    attempts: 0,
    error: null,
    meta: { ...meta, storagePath, mimeType },
    blob: blob || null,
  };
  items.push(item);
  await persist(item);
  emit();
  processQueue();
  return item;
}

export async function enqueueProgress(ticketId, stepId, body) {
  await loadAll();
  // Last write wins per step: replace an older queued write for the same step.
  const existing = items.find((i) => i.type === 'progress' && i.state !== 'synced' && i.meta.ticketId === ticketId && i.meta.stepId === stepId);
  if (existing) {
    await patch(existing.id, { meta: { ticketId, stepId, body }, state: 'queued', error: null });
  } else {
    const item = { id: randomId('pg'), type: 'progress', state: 'queued', createdAt: new Date().toISOString(), attempts: 0, error: null, meta: { ticketId, stepId, body } };
    items.push(item);
    await persist(item);
    emit();
  }
  processQueue();
}

export async function enqueueComplete(ticketId, sandboxId, report, label) {
  await loadAll();
  const item = { id: randomId('cp'), type: 'complete', state: 'queued', createdAt: new Date().toISOString(), attempts: 0, error: null, meta: { ticketId, sandboxId, report, label } };
  items.push(item);
  await persist(item);
  emit();
  processQueue();
  return item;
}

export async function retryItem(id) {
  await patch(id, { state: 'queued', error: null });
  processQueue();
}

export async function removeItem(id) {
  items = items.filter((i) => i.id !== id);
  try {
    await del(id, store);
  } catch {
    /* ignore */
  }
  emit();
}

async function sendEvidence(item) {
  const { meta, blob } = item;
  const body = {
    sandboxId: meta.sandboxId,
    ticketId: meta.ticketId,
    caseId: meta.caseId,
    kind: meta.kind,
    storagePath: meta.storagePath,
    note: meta.note || null,
  };
  if (meta.sample) return api.postEvidence({ ...body, sample: meta.sample });
  if (!blob) throw new Error('Missing media for this item');

  if (MODE === 'firebase') {
    try {
      const fb = await firebaseReady();
      const { ref, uploadBytes } = await import('firebase/storage');
      await uploadBytes(ref(fb.storage, meta.storagePath), blob, { contentType: meta.mimeType });
      return await api.postEvidence(body);
    } catch (err) {
      if (err?.status) throw err; // API error after a good upload: retry later
      console.warn('Storage upload failed, sending media inline', err);
    }
  }
  if (MODE === 'fixtures') return api.postEvidence(body);
  const dataBase64 = await blobToBase64(blob);
  return api.postEvidence({ ...body, dataBase64, mimeType: meta.mimeType });
}

async function sendItem(item) {
  if (item.type === 'evidence') return sendEvidence(item);
  if (item.type === 'progress') return api.putProgress(item.meta.ticketId, item.meta.stepId, item.meta.body);
  if (item.type === 'complete') return api.completeTicket(item.meta.ticketId, item.meta.sandboxId, item.meta.report);
  throw new Error(`Unknown queue item type ${item.type}`);
}

export async function processQueue() {
  await loadAll();
  if (processing || !navigator.onLine) return;
  processing = true;
  try {
    const pending = items.filter((i) => i.state === 'queued' || i.state === 'failed').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const it of pending) {
      if (!navigator.onLine) break;
      await patch(it.id, { state: 'uploading', attempts: (it.attempts || 0) + 1 });
      try {
        const result = await sendItem(it);
        await patch(it.id, { state: 'synced', syncedAt: new Date().toISOString(), error: null, result: summarize(result), blob: null });
        listeners.forEach((fn) => fn([...items]));
        window.dispatchEvent(new CustomEvent('optiflow:synced', { detail: { item: it, result } }));
      } catch (err) {
        await patch(it.id, { state: navigator.onLine ? 'failed' : 'queued', error: err.message || String(err) });
      }
    }
  } finally {
    processing = false;
  }
}

function summarize(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.judged) return { verdict: result.judged.verdict, finding: result.judged.finding };
  if (result.status) return { status: result.status };
  return null;
}

let started = false;
export function startQueueWorker() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => processQueue());
  window.addEventListener('focus', () => processQueue());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') processQueue();
  });
  setInterval(() => {
    if (items.some((i) => i.state === 'failed' || i.state === 'queued')) processQueue();
  }, 15000);
  processQueue();
}

// Reads a sample file from public/samples as a Blob (for thumbnails only).
export async function getLocalBlobUrl(id) {
  const it = items.find((i) => i.id === id) || (await get(id, store).catch(() => null));
  return it?.blob ? URL.createObjectURL(it.blob) : null;
}
