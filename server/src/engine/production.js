import { COUNTRIES, RESOURCES } from '../data/countries.js';

// Activates any Build-for-the-Future bonuses that were purchased last round.
function applyPendingReinvestBonuses(state) {
  const stillPending = [];
  for (const pending of state.pendingReinvestBonuses) {
    if (pending.effectiveRound <= state.round) {
      state.countries[pending.country].permanentBonuses[pending.resource] += 1;
    } else {
      stillPending.push(pending);
    }
  }
  state.pendingReinvestBonuses = stillPending;
}

// Raw per-round production for a country, before the Laos->Thailand transfer.
export function getBaseProduction(country, round, state) {
  const def = COUNTRIES[country].baseProduction;
  const cs = state.countries[country];
  const prod = {};
  for (const key of RESOURCES) {
    prod[key] = def[key] + (cs.permanentBonuses[key] || 0);
  }

  if (country === 'TURKMENISTAN' && cs.gasUnlocked) {
    prod.gas = 4 + (cs.permanentBonuses.gas || 0);
  }
  if ((country === 'CANADA' || country === 'LAOS') && state.flags.canadaLaosPowerBonus) {
    prod.power += 1;
  }
  if (country === 'LAOS' && round === 2) {
    prod.power = 0; // Mekong Drought
  }
  if (country === 'THAILAND' && round === 2) {
    prod.water = Math.max(0, prod.water - 1); // Mekong Drought
  }

  return prod;
}

// Applies this round's production to every country's stockpile, and the
// automatic Laos -> Thailand power transfer. Idempotent per round.
export function applyRoundProduction(state) {
  if (state.round === state._productionAppliedForRound) return;

  applyPendingReinvestBonuses(state);

  for (const code of Object.keys(state.countries)) {
    const cs = state.countries[code];
    const prod = getBaseProduction(code, state.round, state);
    for (const key of Object.keys(prod)) {
      cs.resources[key] += prod[key];
    }
  }

  // Laos -> Thailand automatic power transfer (1 unit), unless Laos produced 0 power.
  const laos = state.countries.LAOS;
  const thailand = state.countries.THAILAND;
  const laosProd = getBaseProduction('LAOS', state.round, state);
  const transferAmount = laosProd.power > 0 ? 1 : 0;
  if (transferAmount > 0) {
    laos.resources.power -= transferAmount;
    thailand.resources.power += transferAmount;
  }
  state.laosTransferAmountThisRound = transferAmount;

  state._productionAppliedForRound = state.round;
}
