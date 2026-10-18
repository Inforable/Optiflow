// Shared live-data hook used by useCase, useTickets, useNotifications and useProgress.
// fixtures: read from the in-browser fixture backend and re-read on every change
// firebase: Firestore onSnapshot
// local:    poll the API every POLL_MS (2 s); refreshNow() forces an immediate poll
import { useCallback, useEffect, useRef, useState } from 'react';
import { MODE, POLL_MS } from '../lib/config';
import { firebaseReady } from '../lib/firebase';
import { subscribe as fxSubscribe } from '../lib/fixtureBackend';

const bus = new Set();
export function refreshNow() {
  bus.forEach((fn) => fn());
}

/**
 * @param {object} o
 * @param {boolean} o.enabled
 * @param {() => Promise<any>} o.fetcher   used in fixtures and local modes (and as a Firebase fallback)
 * @param {(fs, db, onData, onError) => () => void} o.listen   Firestore listener (firebase mode)
 * @param {any[]} o.deps
 */
export function useLive({ enabled = true, fetcher, listen, deps = [] }) {
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    let unsub = () => {};
    let timer = null;
    let inFlight = false;
    let again = false;

    const run = async () => {
      if (inFlight) {
        // A change arrived mid-fetch: fetch once more when this one finishes.
        again = true;
        return;
      }
      inFlight = true;
      try {
        const d = await fetcherRef.current();
        if (alive) {
          setData(d);
          setError(null);
        }
      } catch (err) {
        if (alive) setError(err);
      } finally {
        inFlight = false;
        if (alive) setLoading(false);
        if (again && alive) {
          again = false;
          run();
        }
      }
    };

    if (MODE === 'fixtures') {
      run();
      unsub = fxSubscribe(run);
    } else if (MODE === 'firebase' && listen) {
      firebaseReady().then(async (fb) => {
        if (!alive || !fb) return;
        const fs = await import('firebase/firestore');
        if (!alive) return;
        unsub = listen(
          fs,
          fb.db,
          (d) => {
            if (!alive) return;
            setData(d);
            setError(null);
            setLoading(false);
          },
          (err) => {
            if (!alive) return;
            console.warn('Firestore listener error', err);
            setError(err);
            setLoading(false);
            run();
          },
        );
      });
    } else {
      run();
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') run();
      }, POLL_MS);
      bus.add(run);
      unsub = () => bus.delete(run);
    }
    return () => {
      alive = false;
      unsub();
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tick, ...deps]);

  return { data, error, loading: loading && data === undefined, refresh };
}
