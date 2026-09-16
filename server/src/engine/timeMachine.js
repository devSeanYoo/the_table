// A safety net for live classroom use: automatically checkpoints the full game state at
// the start of every round, so the admin can roll back if something goes wrong (a wrong
// override, a dispute about a trade, a bug) without losing the whole session.
//
// Snapshots live in memory only (lost on server restart, same as the game itself) and are
// keyed by round number. Restoring to round N replaces the live state in place and
// discards any snapshots for rounds after N, since that "future" no longer exists.
//
// The store (a Map) defaults to a shared module-level singleton for production use, but
// every function accepts an explicit store so tests can use an isolated one.

const defaultStore = new Map();

export function recordSnapshot(state, store = defaultStore) {
  store.set(state.round, structuredClone(state));
}

export function listSnapshotRounds(store = defaultStore) {
  return Array.from(store.keys()).sort((a, b) => a - b);
}

// For disk persistence: a Map isn't JSON-serializable, so convert to/from a plain object
// keyed by round number as a string.
export function exportSnapshots(store = defaultStore) {
  const obj = {};
  for (const [round, snap] of store.entries()) obj[round] = snap;
  return obj;
}

export function importSnapshots(obj, store = defaultStore) {
  store.clear();
  for (const [key, snap] of Object.entries(obj || {})) {
    store.set(Number(key), snap);
  }
}

export function restoreSnapshot(state, round, store = defaultStore) {
  const snap = store.get(round);
  if (!snap) return { ok: false, reason: `No saved checkpoint for Round ${round}.` };

  const clone = structuredClone(snap);
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, clone);

  // Never resume a running clock from a restored point — force the admin to press
  // Start Timer again so the countdown is accurate.
  state.timer.running = false;
  state.timer.endsAt = null;

  for (const laterRound of listSnapshotRounds(store)) {
    if (laterRound > round) store.delete(laterRound);
  }

  return { ok: true };
}
