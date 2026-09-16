import { COUNTRIES, COUNTRY_CODES } from './data/countries.js';
import { getBaseProduction } from './engine/production.js';
import { getRequirement } from './engine/requirements.js';

function leaderboard(state) {
  return COUNTRY_CODES.map((code) => ({
    code,
    name: COUNTRIES[code].name,
    flag: COUNTRIES[code].flag,
    score: state.countries[code].score,
  })).sort((a, b) => b.score - a.score);
}

function timerView(state) {
  return {
    remainingSeconds: state.timer.remainingSeconds,
    totalSeconds: state.timer.totalSeconds,
    running: state.timer.running,
    // Absolute deadline (epoch ms), so the client can compute a smooth per-second
    // countdown locally between polls instead of only updating once per poll.
    endsAt: state.timer.endsAt,
    serverNow: Date.now(), // lets the client correct for its own clock being off
  };
}

// Visible to everyone: dashboard, all country pages, and admin.
export function publicView(state) {
  return {
    round: state.round,
    totalRounds: 10,
    phase: state.phase,
    eventRevealed: state.eventRevealed,
    timer: timerView(state),
    leaderboard: leaderboard(state),
    news: state.news.slice(-100),
    round9: {
      revealed: state.round9.revealed,
      complyCount: state.round9.complyCount,
      bonusGranted: state.round9.bonusGranted,
    },
  };
}

function pendingOffersFor(state, country) {
  return state.trades.offers.filter((o) => o.to === country && o.status === 'pending');
}

function sentOffersFor(state, country) {
  return state.trades.offers.filter((o) => o.from === country && o.status === 'pending');
}

function tradeHistoryFor(state, country) {
  return state.trades.history.filter((o) => o.from === country || o.to === country).slice(-50);
}

// Reactive special-move availability, computed fresh each broadcast.
function reactiveAvailability(state, country) {
  const def = COUNTRIES[country].specialMove;
  if (!def.reactive) return null;
  const cs = state.countries[country];
  if (cs.specialMove.usesLeft <= 0 || cs.specialMove.usedThisRound) return false;

  for (let i = state.specialMoveLog.length - 1; i >= 0; i--) {
    const entry = state.specialMoveLog[i];
    if (entry.round !== state.round) break;
    if (entry.moveId !== def.reactsTo) continue;
    if (entry.cancelled) continue;
    if (def.id === 'BACKUP_PLAN' && entry.thailandProtected) continue;
    return true;
  }
  return false;
}

// Country-private view: card, resources, special move state, trades, round 9.
export function countryView(state, country) {
  const def = COUNTRIES[country];
  const cs = state.countries[country];

  return {
    code: country,
    name: def.name,
    flag: def.flag,
    flavor: def.flavor,
    baseProduction: def.baseProduction,
    production: getBaseProduction(country, state.round, state), // this round's actual production rate, after bonuses/unlocks/event effects
    requirement: getRequirement(country, state.round, state), // this round's Track A thresholds for +3
    passiveText: def.passiveText,
    specialMove: {
      ...def.specialMove,
      usesLeft: cs.specialMove.usesLeft,
      usedThisRound: cs.specialMove.usedThisRound,
      reactiveAvailable: reactiveAvailability(state, country),
    },
    reinvestOptions: def.reinvestOptions,
    reinvest: {
      countUsed: cs.reinvest.countUsed,
      nextCost: cs.reinvest.countUsed + 1,
      usedThisRound: cs.reinvest.usedThisRound,
    },
    resources: cs.resources,
    score: cs.score,
    gasUnlocked: cs.gasUnlocked,
    round9Choice: cs.round9Choice,
    incomingOffers: pendingOffersFor(state, country),
    sentOffers: sentOffersFor(state, country),
    tradeHistory: tradeHistoryFor(state, country),
    // Special-move choices this country could target with Turkmenistan's Block It, or
    // trade partners list for Propose Trade — sent generically so the client can render.
    otherCountries: COUNTRY_CODES.filter((c) => c !== country).map((c) => ({ code: c, name: COUNTRIES[c].name, flag: COUNTRIES[c].flag })),
    blockableMoves:
      def.specialMove.id === 'BLOCK_IT'
        ? state.specialMoveLog
            .filter((e) => e.round === state.round && !e.cancelled)
            .map((e) => ({ id: e.id, country: e.country, moveId: e.moveId, moveName: COUNTRIES[e.country].specialMove.name }))
        : [],
  };
}

// Admin sees everything: full per-country resource/passive/special-move detail.
// `availableCheckpoints` is passed in (rather than read from a module-level store) because
// the snapshot store is request-scoped in the serverless deployment — see handlers/shared.js.
export function adminView(state, availableCheckpoints = []) {
  const countries = {};
  for (const code of COUNTRY_CODES) {
    const def = COUNTRIES[code];
    const cs = state.countries[code];
    countries[code] = {
      code,
      name: def.name,
      flag: def.flag,
      passiveText: def.passiveText,
      accessPin: cs.accessPin,
      resources: cs.resources,
      production: getBaseProduction(code, state.round, state),
      requirement: getRequirement(code, state.round, state),
      score: cs.score,
      specialMove: { name: def.specialMove.name, usesMax: def.specialMove.usesMax, usesLeft: cs.specialMove.usesLeft, usedThisRound: cs.specialMove.usedThisRound, visibility: def.specialMove.visibility },
      reinvestCountUsed: cs.reinvest.countUsed,
      gasUnlocked: cs.gasUnlocked,
      turkmenistanMineralsReceived: cs.turkmenistanMineralsReceived,
      round9Choice: cs.round9Choice,
      permanentBonuses: cs.permanentBonuses,
    };
  }

  return {
    ...publicView(state),
    flags: state.flags,
    countries,
    pendingOffers: state.trades.offers.filter((o) => o.status === 'pending'),
    tradeHistory: state.trades.history.slice(-100),
    specialMoveLog: state.specialMoveLog.slice(-100),
    adminLog: state.adminLog.slice(-100),
    availableCheckpoints,
  };
}
