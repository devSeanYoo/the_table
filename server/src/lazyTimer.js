// The old Socket.IO server had a setInterval ticking every second to notice when a round's
// timer hit 0 and lock it automatically. A serverless function can't run a background
// timer between requests — instead, every request checks "should this already have ended?"
// and processes it right then. Since polling happens every few seconds, a round locks
// within a few seconds of its real deadline either way.

import { lockAndScoreRound, lockTradingRound9 } from './engine/roundLifecycle.js';

// Mutates state in place if the running timer has expired. Returns true if it changed
// anything (so the caller knows to persist).
export function ensureTimerProcessed(state) {
  if (!state.timer.running) return false;
  const remaining = Math.max(0, Math.round((state.timer.endsAt - Date.now()) / 1000));
  if (remaining > 0) {
    state.timer.remainingSeconds = remaining;
    return false;
  }

  state.timer.running = false;
  state.timer.endsAt = null;
  state.timer.remainingSeconds = 0;
  if (state.round === 9) lockTradingRound9(state);
  else lockAndScoreRound(state);
  return true;
}
