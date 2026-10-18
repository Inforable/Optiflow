// Checklist progress writes from the Engineer app.
//   firebase: Firestore `sandboxes/{sid}/tickets/{tid}/progress/{stepId}` (offline-safe, synced by the SDK)
//   local:    PUT /api/tickets/{tid}/progress/{stepId}, queued in IndexedDB when offline or failing
//   fixtures: in-browser fixture backend
import { MODE } from './config';
import { firebaseReady } from './firebase';
import * as api from './api';
import { enqueueProgress } from './offlineQueue';

export async function writeProgress(session, ticketId, stepId, data) {
  const body = {
    sandboxId: session.sandboxId,
    done: data.done ?? true,
    result: data.result ?? null,
    note: data.note ?? null,
    reading: data.reading ?? null,
  };
  if (MODE === 'firebase') {
    const fb = await firebaseReady();
    const { doc, setDoc } = await import('firebase/firestore');
    const ref = doc(fb.db, 'sandboxes', session.sandboxId, 'tickets', ticketId, 'progress', stepId);
    // Not awaited: offline, the promise resolves only once the server acknowledges.
    setDoc(ref, { done: body.done, result: body.result, note: body.note, reading: body.reading, by: session.uid || 'engineer', at: new Date().toISOString() }, { merge: true }).catch(
      (err) => console.warn('Progress write rejected', err),
    );
    return { queued: !navigator.onLine };
  }
  if (MODE === 'fixtures') {
    if (!navigator.onLine) {
      await enqueueProgress(ticketId, stepId, body);
      return { queued: true };
    }
    await api.putProgress(ticketId, stepId, body);
    return { queued: false };
  }
  if (!navigator.onLine) {
    await enqueueProgress(ticketId, stepId, body);
    return { queued: true };
  }
  try {
    await api.putProgress(ticketId, stepId, body);
    return { queued: false };
  } catch {
    await enqueueProgress(ticketId, stepId, body);
    return { queued: true };
  }
}
