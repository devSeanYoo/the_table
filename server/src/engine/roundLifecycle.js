import { COUNTRY_CODES } from '../data/countries.js';
import { EVENTS } from '../data/events.js';
import { generatePin } from '../state.js';
import { applyRoundProduction } from './production.js';
import { applyTrackA } from './scoring.js';
import { addNews, addAdminLog } from './utils.js';

const TOTAL_ROUNDS = 10;
// Rounds 9 and 10 both start trading with no announcement — the twist is a surprise, not
// something to plan the whole round around. Where they differ is what "reveal" means:
//   Round 10: no player action at all. Trading locks, Track A scores as usual, and once
//     the admin clicks Reveal Event the Battery Boom bonus (based on final holdings) is
//     added right then — a dramatic score jump on cue.
//   Round 9: the Comply/Ignore vote *is* a player action, but only after negotiation ends
//     — trading closes into a new 'voting' phase (no scoring yet), the admin reveals the
//     event to explain the vote, countries submit their choice, and only once the admin
//     clicks Reveal Round 9 Results does Track A actually run — using those choices.
const NO_PRE_REVEAL_ROUNDS = [9, 10];

export function revealEvent(state) {
  if (state.eventRevealed) return { ok: false, reason: 'Event already revealed for this round.' };

  if (state.round === 9 && state.phase !== 'voting') {
    return { ok: false, reason: 'Round 9 can only be revealed after trading closes (timer ends).' };
  }
  if (state.round === 10 && state.phase !== 'locked') {
    return { ok: false, reason: 'This round\'s twist is only revealed after the timer reaches 0.' };
  }

  const event = EVENTS[state.round];
  if (event) {
    addNews(state, `📰 Round ${state.round}: ${event.title} — ${event.flavor}`);
    for (const line of event.effectSummary) addNews(state, line);
  } else {
    addNews(state, `Round ${state.round} begins. No event this round.`);
  }

  // Round 6: requirement upgrade applies starting this round's Track A.
  if (state.round === 6) {
    state.flags.upperGroupReqUpgraded = true;
  }

  // Round 10: Battery Boom applies exactly when revealed — a visible score jump on cue,
  // based on whatever Minerals each country ended the round holding (phase is already
  // 'locked' by this point, so nothing has changed since Track A ran).
  if (state.round === 10) {
    for (const code of COUNTRY_CODES) {
      const cs = state.countries[code];
      if (cs.resources.mineral > 0) {
        cs.score += cs.resources.mineral;
        addNews(state, `${code} gets +${cs.resources.mineral} points from Battery Boom.`);
      }
    }
  }

  state.eventRevealed = true;
  return { ok: true, event: event ?? null };
}

// Rounds 9 and 10 can start trading with no announcement (see NO_PRE_REVEAL_ROUNDS above);
// every other round needs Reveal Event first as usual.
export function startTimer(state) {
  if (state.phase === 'locked' || state.phase === 'voting' || state.phase === 'game_over') {
    return { ok: false, reason: 'This round has already ended.' };
  }
  if (!state.eventRevealed && !NO_PRE_REVEAL_ROUNDS.includes(state.round)) {
    return { ok: false, reason: "Reveal this round's event before starting the timer." };
  }
  applyRoundProduction(state);
  state.phase = 'active';
  state.timer.running = true;
  state.timer.endsAt = Date.now() + state.timer.remainingSeconds * 1000;
  return { ok: true };
}

export function pauseTimer(state) {
  if (!state.timer.running) return { ok: false, reason: 'Timer is not running.' };
  const remaining = Math.max(0, Math.round((state.timer.endsAt - Date.now()) / 1000));
  state.timer.remainingSeconds = remaining;
  state.timer.running = false;
  state.timer.endsAt = null;
  return { ok: true };
}

export function resetTimer(state) {
  state.timer.running = false;
  state.timer.endsAt = null;
  state.timer.remainingSeconds = state.timer.totalSeconds;
  // Whether the event was already revealed is tracked separately (state.eventRevealed) —
  // resetting the clock just takes trading back to 'setup', not a distinct phase.
  if (state.phase === 'active') state.phase = 'setup';
  return { ok: true };
}

// Called every server tick (~1s) while a timer is running. Returns true if the
// round was just locked (or, for Round 9, moved into voting) as a result of this tick.
export function tickTimer(state) {
  if (!state.timer.running) return false;
  const remaining = Math.max(0, Math.round((state.timer.endsAt - Date.now()) / 1000));
  state.timer.remainingSeconds = remaining;
  if (remaining <= 0) {
    state.timer.running = false;
    state.timer.endsAt = null;
    if (state.round === 9) lockTradingRound9(state);
    else lockAndScoreRound(state);
    return true;
  }
  return false;
}

// Standard end-of-round: close trading and run Track A immediately. Used by every round
// except 9, which needs the vote to happen first (see lockTradingRound9 below).
export function lockAndScoreRound(state) {
  if (state.phase === 'locked' || state.phase === 'game_over') return { ok: false, reason: 'Round already locked.' };
  state.phase = 'locked';
  const results = applyTrackA(state);
  addNews(state, `Round ${state.round} ended. Scores updated.`);
  return { ok: true, results };
}

// Round 9 only: closes trading (negotiation is over) without scoring anything yet. The
// admin still needs to Reveal Event (explain the vote), let countries submit Comply/
// Ignore, then click Reveal Round 9 Results — which is what actually runs Track A.
export function lockTradingRound9(state) {
  if (state.phase === 'voting' || state.phase === 'locked' || state.phase === 'game_over') {
    return { ok: false, reason: 'Round already locked.' };
  }
  state.phase = 'voting';
  addNews(state, `Round ${state.round} trading has closed.`);
  return { ok: true };
}

// Debug helper: skip waiting for the real-time timer and end the round immediately.
export function forceEndRound(state) {
  if (state.phase === 'locked' || state.phase === 'voting' || state.phase === 'game_over') {
    return { ok: false, reason: 'Round already locked.' };
  }
  applyRoundProduction(state); // in case the admin never clicked Start Timer this round
  state.timer.running = false;
  state.timer.endsAt = null;
  state.timer.remainingSeconds = 0;
  if (state.round === 9) return lockTradingRound9(state);
  return lockAndScoreRound(state);
}

export function nextRound(state) {
  if (state.phase !== 'locked') {
    return { ok: false, reason: 'End the round (let the timer finish) before moving on.' };
  }
  if (state.round === 9 && !state.round9.resultApplied) {
    return { ok: false, reason: 'Reveal Round 9 Results before moving on to Round 10.' };
  }

  // Permanent effect that activates the round AFTER round 4 ends.
  if (state.round === 4) {
    state.flags.canadaLaosPowerBonus = true;
  }

  if (state.round >= TOTAL_ROUNDS) {
    state.phase = 'game_over';
    addNews(state, 'The game has ended. Thank you for playing THE TABLE!');
    return { ok: true, gameOver: true };
  }

  state.round += 1;
  state.phase = 'setup';
  state.eventRevealed = false;
  state.timer.running = false;
  state.timer.endsAt = null;
  state.timer.remainingSeconds = state.timer.totalSeconds;
  state.laosTransferAmountThisRound = 0;

  for (const code of COUNTRY_CODES) {
    const cs = state.countries[code];
    cs.reinvest.usedThisRound = false;
    cs.specialMove.usedThisRound = false;
    cs.round9Choice = null;
    cs.thisRound = {
      emergencyReleaseUsed: false,
      backupPlanUsed: false,
      stopEthiopiaAvailable: false,
      waterControlTargetedEgypt: false,
      quickSwapUsed: 0,
      specialDealActiveRound: null,
    };
  }

  // Note: checkpointing the fresh round is the caller's responsibility (see
  // server/src/dispatch.js) — this module doesn't know which snapshot store to use.

  return { ok: true };
}

// Voting happens after negotiation closes (phase 'voting'), once the event has been
// revealed to explain what the vote is for.
export function submitRound9Choice(state, country, choice) {
  if (state.round !== 9) return { ok: false, reason: 'This is only for Round 9.' };
  if (state.phase !== 'voting') return { ok: false, reason: 'Voting opens once trading closes.' };
  if (!state.eventRevealed) return { ok: false, reason: 'Wait for the event to be revealed first.' };
  if (!['comply', 'ignore'].includes(choice)) return { ok: false, reason: 'Choice must be comply or ignore.' };
  state.countries[country].round9Choice = choice;
  return { ok: true };
}

// This is the moment Round 9's score is finally calculated — Track A runs here (using
// each country's submitted Comply/Ignore choice), then the group-compliance bonus is
// checked, and only then does the round actually lock.
export function revealRound9Results(state) {
  if (state.round !== 9) return { ok: false, reason: 'This is only for Round 9.' };
  if (state.phase !== 'voting') return { ok: false, reason: 'Wait for trading to close first.' };
  if (!state.eventRevealed) return { ok: false, reason: 'Reveal the event before revealing results.' };
  if (state.round9.resultApplied) return { ok: false, reason: 'Round 9 results already revealed.' };

  applyTrackA(state);

  const complyCount = COUNTRY_CODES.filter((c) => state.countries[c].round9Choice === 'comply').length;
  const bonusGranted = complyCount >= 6;

  if (bonusGranted) {
    for (const code of COUNTRY_CODES) state.countries[code].score += 3;
  }

  state.round9.revealed = true;
  state.round9.complyCount = complyCount;
  state.round9.bonusGranted = bonusGranted;
  state.round9.resultApplied = true;
  state.phase = 'locked';

  addNews(state, 'Round 9 ended. Scores updated.');
  addNews(
    state,
    bonusGranted
      ? `The Climate Deal: ${complyCount} countries complied. Everyone gets +3 points!`
      : `The Climate Deal: only ${complyCount} countries complied. No bonus this time.`
  );

  return { ok: true, complyCount, bonusGranted };
}

export function applyLanguagePenalty(state, country, resource, amount) {
  const cs = state.countries[country];
  const qty = Math.max(0, Number(amount) || 0);
  cs.resources[resource] = Math.max(0, cs.resources[resource] - qty);
  addAdminLog(state, 'LANGUAGE_PENALTY', { country, resource, amount: qty });
  return { ok: true };
}

export function manualOverride(state, country, patch) {
  const cs = state.countries[country];
  if (!cs) return { ok: false, reason: 'Unknown country.' };

  if (patch.resources) {
    for (const [key, value] of Object.entries(patch.resources)) {
      if (key in cs.resources) cs.resources[key] = Math.max(0, Number(value) || 0);
    }
  }
  if (typeof patch.score === 'number') cs.score = patch.score;
  if (typeof patch.specialMoveUsesLeft === 'number') cs.specialMove.usesLeft = patch.specialMoveUsesLeft;
  if (typeof patch.reinvestCountUsed === 'number') cs.reinvest.countUsed = patch.reinvestCountUsed;
  if (typeof patch.gasUnlocked === 'boolean') cs.gasUnlocked = patch.gasUnlocked;

  // Undoes one Build for the Future bonus for this country/resource — e.g. a team picked
  // the wrong resource. If it hasn't taken effect yet, drop it from the pending queue;
  // otherwise it's already folded into permanentBonuses, so remove it from there instead.
  if (patch.cancelReinvestBonus?.resource) {
    const resource = patch.cancelReinvestBonus.resource;
    const pendingIndex = state.pendingReinvestBonuses.findIndex((p) => p.country === country && p.resource === resource);
    if (pendingIndex !== -1) {
      state.pendingReinvestBonuses.splice(pendingIndex, 1);
    } else if (cs.permanentBonuses[resource] > 0) {
      cs.permanentBonuses[resource] -= 1;
    }
  }

  addAdminLog(state, 'MANUAL_OVERRIDE', { country, patch });
  return { ok: true };
}

export function regeneratePin(state, country) {
  const cs = state.countries[country];
  if (!cs) return { ok: false, reason: 'Unknown country.' };
  cs.accessPin = generatePin();
  addAdminLog(state, 'REGENERATE_PIN', { country });
  return { ok: true, pin: cs.accessPin };
}
