import { COUNTRIES } from '../data/countries.js';

export function buildForFuture(state, country, resource) {
  const cs = state.countries[country];
  const def = COUNTRIES[country];

  if (state.phase !== 'active') return { ok: false, reason: 'Trading is not open right now.' };
  if (!def.reinvestOptions.includes(resource)) {
    return { ok: false, reason: `${def.name} cannot build up ${resource}.` };
  }
  if (cs.reinvest.usedThisRound) {
    return { ok: false, reason: 'You can only Build for the Future once per round.' };
  }

  const cost = cs.reinvest.countUsed + 1; // 1, then 2, then 3...
  if (cs.resources.mineral < cost || cs.resources.power < cost) {
    return { ok: false, reason: `You need ${cost} Mineral and ${cost} Power to build this time.` };
  }

  cs.resources.mineral -= cost;
  cs.resources.power -= cost;
  cs.reinvest.countUsed += 1;
  cs.reinvest.usedThisRound = true;
  cs.reinvest.history.push({ round: state.round, resource, cost, effectiveRound: state.round + 1 });

  state.pendingReinvestBonuses.push({ country, resource, effectiveRound: state.round + 1 });

  return { ok: true, cost, resource, effectiveRound: state.round + 1 };
}
