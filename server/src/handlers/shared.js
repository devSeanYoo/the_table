// Shared load/create/timer-check logic used by both the state and action handlers, so
// they always start from the same up-to-date, timer-corrected state before doing anything
// role-specific.

import { createInitialState } from '../state.js';
import { loadGame, saveGame } from '../persistence.js';
import { recordSnapshot, importSnapshots, exportSnapshots } from '../engine/timeMachine.js';
import { ensureTimerProcessed } from '../lazyTimer.js';

// Loads (or creates, on the very first request ever) the game, returning the mutable
// `state` object plus a snapshot `store` (a Map, populated from the persisted snapshots)
// that the caller can pass into timeMachine functions. Also auto-locks the round if its
// timer already expired, same as the old server's background tick did.
export async function loadCurrentGame() {
  const saved = await loadGame();
  const store = new Map();

  let state;
  let isNew = false;
  if (saved) {
    state = saved.state;
    importSnapshots(saved.snapshots, store);
  } else {
    state = createInitialState();
    recordSnapshot(state, store); // checkpoint Round 1's fresh start
    isNew = true;
  }

  const timerChanged = ensureTimerProcessed(state);
  return { state, store, dirty: isNew || timerChanged };
}

export async function persistGame(state, store) {
  await saveGame(state, exportSnapshots(store));
}

export function jsonResponse(status, body) {
  return { status, body };
}
