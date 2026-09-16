import { useCallback, useEffect, useRef, useState } from 'react';

// In production (Vercel) the client and /api/* are served from the same domain, so the
// default is a relative path. Local dev (Vite on 5173) talks to the separate dev-server.js
// on 4000 unless VITE_API_URL overrides it.
const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:4000' : '');

export async function fetchState(credentials) {
  const params = new URLSearchParams(credentials);
  try {
    const res = await fetch(`${API_URL}/api/state?${params.toString()}`);
    return await res.json();
  } catch {
    return { ok: false, reason: 'Could not reach the server. Check your connection.' };
  }
}

export async function callAction(action, payload, credentials) {
  try {
    const res = await fetch(`${API_URL}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...credentials, action, payload }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: 'Could not reach the server. Check your connection.' };
  }
}

// Polls fetchFn on an interval (immediately on mount/dep change too), skipping overlapping
// calls. `refetch()` lets callers force an immediate refresh — used right after an action
// succeeds, so the actor sees their own change instantly instead of waiting for the next
// scheduled poll.
export function usePolling(fetchFn, intervalMs, deps) {
  const [data, setData] = useState(null);
  const fnRef = useRef(fetchFn);
  fnRef.current = fetchFn;
  const inFlightRef = useRef(false);

  const doFetch = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const result = await fnRef.current();
      setData(result);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    doFetch();
    const id = setInterval(doFetch, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, refetch: doFetch };
}
