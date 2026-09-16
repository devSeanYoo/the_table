// Maps action names (matching the old Socket.IO event names, kept for continuity) to the
// engine function that handles them. This is the one place that knows how an HTTP action
// request turns into a call against the pure game-engine functions in engine/*.js.
//
// Each entry's `run` receives (state, ctx, payload):
//   - state:   the full mutable game state (already loaded from persistence)
//   - ctx:     { country } for country-role actions — the PIN-authenticated country code
//   - payload: the request body's `payload` field
// and returns the same { ok, ... } shape the engine functions already return.

import {
  revealEvent,
  startTimer,
  pauseTimer,
  resetTimer,
  forceEndRound,
  nextRound,
  submitRound9Choice,
  revealRound9Results,
  applyLanguagePenalty,
  manualOverride,
  regeneratePin,
} from './engine/roundLifecycle.js';
import { proposeTrade, acceptTrade, rejectTrade, counterTrade } from './engine/trades.js';
import { useSpecialMove } from './engine/specialMoves.js';
import { buildForFuture } from './engine/reinvest.js';

export const ACTIONS = {
  'admin:revealEvent': { role: 'admin', run: (state) => revealEvent(state) },
  'admin:startTimer': { role: 'admin', run: (state) => startTimer(state) },
  'admin:pauseTimer': { role: 'admin', run: (state) => pauseTimer(state) },
  'admin:resetTimer': { role: 'admin', run: (state) => resetTimer(state) },
  'admin:forceEndRound': { role: 'admin', run: (state) => forceEndRound(state) },
  'admin:nextRound': { role: 'admin', run: (state) => nextRound(state) },
  'admin:revealRound9': { role: 'admin', run: (state) => revealRound9Results(state) },
  'admin:applyPenalty': {
    role: 'admin',
    run: (state, ctx, payload) => applyLanguagePenalty(state, payload.country, payload.resource, payload.amount),
  },
  'admin:override': {
    role: 'admin',
    run: (state, ctx, payload) => manualOverride(state, payload.country, payload.patch),
  },
  'admin:regeneratePin': {
    role: 'admin',
    run: (state, ctx, payload) => regeneratePin(state, payload.country),
  },
  // 'admin:restoreRound' is handled specially in api/action.js — it also needs the
  // per-request snapshot store, which no other action does.

  'country:proposeTrade': {
    role: 'country',
    run: (state, ctx, payload) => proposeTrade(state, { from: ctx.country, to: payload.to, give: payload.give, want: payload.want }),
  },
  'country:acceptTrade': {
    role: 'country',
    run: (state, ctx, payload) => acceptTrade(state, payload.offerId, ctx.country),
  },
  'country:rejectTrade': {
    role: 'country',
    run: (state, ctx, payload) => rejectTrade(state, payload.offerId, ctx.country),
  },
  'country:counterTrade': {
    role: 'country',
    run: (state, ctx, payload) => counterTrade(state, payload.offerId, ctx.country, { give: payload.give, want: payload.want }),
  },
  'country:useSpecialMove': {
    role: 'country',
    run: (state, ctx, payload) => useSpecialMove(state, ctx.country, payload),
  },
  'country:buildForFuture': {
    role: 'country',
    run: (state, ctx, payload) => buildForFuture(state, ctx.country, payload.resource),
  },
  'country:submitRound9': {
    role: 'country',
    run: (state, ctx, payload) => submitRound9Choice(state, ctx.country, payload.choice),
  },
};
