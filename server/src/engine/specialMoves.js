import { COUNTRIES } from '../data/countries.js';
import { addNews } from './utils.js';
import { getBaseProduction } from './production.js';

function pushMoveLog(state, entry) {
  const full = {
    id: state.nextLogId++,
    round: state.round,
    ts: Date.now(),
    cancelled: false,
    cancelledBy: null,
    ...entry,
  };
  state.specialMoveLog.push(full);
  return full;
}

function findActiveLog(state, moveId, opts = {}) {
  for (let i = state.specialMoveLog.length - 1; i >= 0; i--) {
    const entry = state.specialMoveLog[i];
    if (entry.round !== state.round) break;
    if (entry.moveId !== moveId) continue;
    if (entry.cancelled) continue;
    if (opts.targetCountry && entry.targetCountry !== opts.targetCountry) continue;
    return entry;
  }
  return null;
}

// Reverses the effect of a WATER_CONTROL log entry (used by both Egypt's Stop Ethiopia
// and Turkmenistan's Block It).
function nullifyWaterControl(state, entry) {
  const ethiopia = state.countries.ETHIOPIA;
  const egypt = state.countries.EGYPT;
  ethiopia.resources.water -= entry.ethiopiaGain;
  egypt.resources.water += entry.waterLost;
  egypt.resources.power += entry.powerLost;
}

// Fully reverses EMERGENCY_RELEASE (used by Turkmenistan's Block It — unlike Thailand's
// Backup Plan, this also strips Laos of its own gain).
function nullifyEmergencyRelease(state, entry) {
  const laos = state.countries.LAOS;
  const thailand = state.countries.THAILAND;
  laos.resources.power -= 2;
  if (entry.transferReversed) {
    laos.resources.power -= entry.transferAmount;
    thailand.resources.power += entry.transferAmount;
  }
}

// When an event has zeroed out a country's production of some resource this round,
// that country's own Special Move should not be able to grant that resource anyway —
// otherwise the event's limitation would be meaningless. Currently the only case is
// the Round 2 Mekong Drought, which stops Laos's dams entirely.
function suppressedByEvent(state, country, resource) {
  if (country === 'LAOS' && resource === 'power' && state.round === 2) return true;
  return false;
}

export function useSpecialMove(state, country, payload = {}) {
  const cs = state.countries[country];
  const result = attemptSpecialMove(state, country, payload);
  if (result.ok) cs.specialMove.usedThisRound = true;
  return result;
}

function attemptSpecialMove(state, country, payload) {
  if (state.phase !== 'active') return { ok: false, reason: 'Special Moves can only be used while trading is open.' };

  const def = COUNTRIES[country].specialMove;
  const cs = state.countries[country];

  if (cs.specialMove.usesLeft <= 0) {
    return { ok: false, reason: `${def.name} has already been used the maximum number of times.` };
  }
  if (cs.specialMove.usedThisRound) {
    return { ok: false, reason: `${def.name} can only be used once per round.` };
  }

  switch (def.id) {
    case 'WATER_CONTROL': {
      const egypt = state.countries.EGYPT;
      // Only strips this round's Water/Power production, not Egypt's whole stockpile —
      // can't take more than Egypt actually has, in case it was already spent/traded away.
      const egyptProd = getBaseProduction('EGYPT', state.round, state);
      const waterLost = Math.min(egypt.resources.water, egyptProd.water);
      const powerLost = Math.min(egypt.resources.power, egyptProd.power);
      state.countries.ETHIOPIA.resources.water += 2;
      egypt.resources.water -= waterLost;
      egypt.resources.power -= powerLost;
      cs.specialMove.usesLeft -= 1;
      pushMoveLog(state, {
        moveId: 'WATER_CONTROL',
        country,
        targetCountry: 'EGYPT',
        ethiopiaGain: 2,
        waterLost,
        powerLost,
      });
      addNews(state, "Ethiopia used Water Control. Egypt lost this round's Water and Power production.");
      return { ok: true };
    }

    case 'STOP_ETHIOPIA': {
      const active = findActiveLog(state, 'WATER_CONTROL', { targetCountry: 'EGYPT' });
      if (!active) return { ok: false, reason: 'Ethiopia has not used Water Control against you this round.' };
      nullifyWaterControl(state, active);
      active.cancelled = true;
      active.cancelledBy = 'EGYPT';
      cs.specialMove.usesLeft -= 1;
      addNews(state, "Egypt used Stop Ethiopia — Water Control was cancelled.");
      return { ok: true };
    }

    case 'EMERGENCY_RELEASE': {
      if (suppressedByEvent(state, 'LAOS', 'power')) {
        return { ok: false, reason: 'The Mekong Drought has stopped your dams completely this round — Emergency Release has nothing to release.' };
      }
      const thailand = state.countries.THAILAND;
      const alreadyUsedThisRound = cs.thisRound.emergencyReleaseUsed;
      cs.resources.power += 2;
      let transferReversed = false;
      if (!alreadyUsedThisRound) {
        const amount = state.laosTransferAmountThisRound;
        if (amount > 0) {
          cs.resources.power += amount;
          thailand.resources.power -= amount;
        }
        cs.thisRound.emergencyReleaseUsed = true;
        transferReversed = true;
      }
      cs.specialMove.usesLeft -= 1;
      pushMoveLog(state, {
        moveId: 'EMERGENCY_RELEASE',
        country,
        targetCountry: 'THAILAND',
        transferAmount: state.laosTransferAmountThisRound,
        transferReversed,
      });
      addNews(state, 'Laos used Emergency Release. Thailand gets zero Power this round.');
      return { ok: true };
    }

    case 'BACKUP_PLAN': {
      const active = findActiveLog(state, 'EMERGENCY_RELEASE', { targetCountry: 'THAILAND' });
      if (!active) return { ok: false, reason: 'Laos has not used Emergency Release against you this round.' };
      if (active.thailandProtected) return { ok: false, reason: 'You have already protected yourself this round.' };
      cs.resources.power += active.transferAmount;
      active.thailandProtected = true;
      cs.specialMove.usesLeft -= 1;
      // Private move: no public news.
      return { ok: true };
    }

    case 'BLOCK_IT': {
      const targetLogId = payload.targetLogId;
      const entry = state.specialMoveLog.find((e) => e.id === targetLogId && e.round === state.round && !e.cancelled);
      if (!entry) return { ok: false, reason: 'Choose a Special Move used this round to cancel.' };

      if (entry.moveId === 'WATER_CONTROL') nullifyWaterControl(state, entry);
      else if (entry.moveId === 'EMERGENCY_RELEASE') nullifyEmergencyRelease(state, entry);
      else if (entry.moveId === 'CLAIM_NEW_LAND') state.countries.VENEZUELA.resources.oil -= 3;
      else return { ok: false, reason: 'This Special Move cannot be blocked automatically — ask the teacher to use Manual Override.' };

      entry.cancelled = true;
      entry.cancelledBy = 'TURKMENISTAN';
      cs.specialMove.usesLeft -= 1;
      addNews(state, `Turkmenistan used Block It against ${entry.country}'s ${COUNTRIES[entry.country].specialMove.name}.`);
      return { ok: true };
    }

    case 'CLAIM_NEW_LAND': {
      cs.resources.oil += 3;
      cs.specialMove.usesLeft -= 1;
      pushMoveLog(state, { moveId: 'CLAIM_NEW_LAND', country, targetCountry: null });
      addNews(state, 'Venezuela used Claim New Land: +3 Oil from outside the game.');
      return { ok: true };
    }

    case 'TAKE_IT_BACK': {
      const history = state.trades.history;
      let target = null;
      for (let i = history.length - 1; i >= 0; i--) {
        const o = history[i];
        if (o.status !== 'accepted') continue;
        if (o.from === 'BOLIVIA' && o.give.qty > 0) { target = { offer: o, side: 'give' }; break; }
        if (o.to === 'BOLIVIA' && o.want.qty > 0) { target = { offer: o, side: 'want' }; break; }
      }
      if (!target) return { ok: false, reason: 'Bolivia has no recent outgoing trade to take back.' };

      const { offer, side } = target;
      const leg = offer[side]; // { resource, qty }
      const delivered = side === 'give' ? offer.delivered.give : offer.delivered.want;
      const receiver = side === 'give' ? offer.to : offer.from;
      cs.resources[leg.resource] += leg.qty;
      state.countries[receiver].resources[leg.resource] = Math.max(0, state.countries[receiver].resources[leg.resource] - delivered);

      cs.specialMove.usesLeft -= 1;
      addNews(state, 'Bolivia used Take It Back: its most recent trade was reversed.');
      return { ok: true };
    }

    case 'SPECIAL_DEAL': {
      cs.thisRound.specialDealActiveRound = state.round;
      cs.specialMove.usesLeft -= 1;
      addNews(state, 'Ukraine used Special Deal: the 3-unit Food trade rule is lifted this round.');
      return { ok: true };
    }

    case 'QUICK_SWAP': {
      const { giveResource, receiveResource } = payload;
      if (!giveResource || !receiveResource || giveResource === receiveResource) {
        return { ok: false, reason: 'Choose two different resources to swap.' };
      }
      if (cs.resources[giveResource] < 1) {
        return { ok: false, reason: `You need at least 1 ${giveResource} to swap.` };
      }
      cs.resources[giveResource] -= 1;
      cs.resources[receiveResource] += 1;
      cs.specialMove.usesLeft -= 1;
      // Private move: no public news.
      return { ok: true };
    }

    default:
      return { ok: false, reason: 'Unknown Special Move.' };
  }
}
