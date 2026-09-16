import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { applyRoundProduction } from '../src/engine/production.js';
import { getRequirement } from '../src/engine/requirements.js';
import { proposeTrade, acceptTrade } from '../src/engine/trades.js';
import { useSpecialMove } from '../src/engine/specialMoves.js';
import { buildForFuture } from '../src/engine/reinvest.js';
import { applyTrackA } from '../src/engine/scoring.js';
import { revealEvent, startTimer, nextRound, lockAndScoreRound, lockTradingRound9, submitRound9Choice, revealRound9Results, forceEndRound, tickTimer } from '../src/engine/roundLifecycle.js';
import { recordSnapshot, listSnapshotRounds, restoreSnapshot } from '../src/engine/timeMachine.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

function freshActiveState() {
  const state = createInitialState();
  revealEvent(state); // round 1, no event
  startTimer(state); // applies round-1 production, phase=active
  return state;
}

test('round 1 production matches base stats', () => {
  const state = freshActiveState();
  assert.equal(state.countries.CANADA.resources.oil, 1);
  assert.equal(state.countries.BOLIVIA.resources.mineral, 3);
  // Laos->Thailand transfer: Laos base power 3 -1 transfer = 2, Thailand 0+1=1
  assert.equal(state.countries.LAOS.resources.power, 2);
  assert.equal(state.countries.THAILAND.resources.power, 1);
});

test('basic trade: Canada gives 1 oil, Ethiopia gives 1 water back', () => {
  const state = freshActiveState();
  const propose = proposeTrade(state, { from: 'CANADA', to: 'ETHIOPIA', give: { resource: 'oil', qty: 1 }, want: { resource: 'water', qty: 1 } });
  assert.ok(propose.ok, propose.reason);
  const before = {
    canadaOil: state.countries.CANADA.resources.oil,
    canadaWater: state.countries.CANADA.resources.water,
    ethiopiaWater: state.countries.ETHIOPIA.resources.water,
    ethiopiaOil: state.countries.ETHIOPIA.resources.oil,
  };
  const accept = acceptTrade(state, propose.offer.id, 'ETHIOPIA');
  assert.ok(accept.ok, accept.reason);
  assert.equal(state.countries.CANADA.resources.oil, before.canadaOil - 1); // sent away
  assert.equal(state.countries.CANADA.resources.water, before.canadaWater + 1); // received back
  assert.equal(state.countries.ETHIOPIA.resources.water, before.ethiopiaWater - 1); // sent away
  assert.equal(state.countries.ETHIOPIA.resources.oil, before.ethiopiaOil + 1); // received
});

test('Bolivia passive: receiver gets 1 less than sent', () => {
  const state = freshActiveState();
  const propose = proposeTrade(state, { from: 'BOLIVIA', to: 'CANADA', give: { resource: 'mineral', qty: 3 }, want: { resource: 'oil', qty: 0 } });
  assert.ok(propose.ok, propose.reason);
  const canadaMineralBefore = state.countries.CANADA.resources.mineral;
  const accept = acceptTrade(state, propose.offer.id, 'CANADA');
  assert.ok(accept.ok, accept.reason);
  assert.equal(state.countries.CANADA.resources.mineral, canadaMineralBefore + 2); // 3 sent, -1 passive = 2 received
});

test('Ukraine cannot send Food under 3 units', () => {
  const state = freshActiveState();
  const propose = proposeTrade(state, { from: 'UKRAINE', to: 'CANADA', give: { resource: 'food', qty: 2 }, want: { resource: 'oil', qty: 1 } });
  assert.equal(propose.ok, false);
});

test('Ukraine Special Deal lifts the 3-unit rule for the round', () => {
  const state = freshActiveState();
  const move = useSpecialMove(state, 'UKRAINE', {});
  assert.ok(move.ok, move.reason);
  const propose = proposeTrade(state, { from: 'UKRAINE', to: 'CANADA', give: { resource: 'food', qty: 1 }, want: { resource: 'oil', qty: 1 } });
  assert.ok(propose.ok, propose.reason);
});

test('Venezuela cannot send Oil without Power', () => {
  const state = freshActiveState();
  assert.equal(state.countries.VENEZUELA.resources.power, 0);
  const propose = proposeTrade(state, { from: 'VENEZUELA', to: 'CANADA', give: { resource: 'oil', qty: 1 }, want: { resource: 'mineral', qty: 1 } });
  assert.equal(propose.ok, false);
});

test('Turkmenistan gas unlocks after receiving 3 cumulative Minerals', () => {
  const state = freshActiveState();
  state.countries.BOLIVIA.resources.mineral = 10; // stockpile enough to send a large single trade
  const p1 = proposeTrade(state, { from: 'BOLIVIA', to: 'TURKMENISTAN', give: { resource: 'mineral', qty: 4 }, want: { resource: 'oil', qty: 0 } });
  assert.ok(p1.ok, p1.reason);
  acceptTrade(state, p1.offer.id, 'TURKMENISTAN');
  // Bolivia passive: 4 sent -> 3 delivered, hits the threshold exactly.
  assert.equal(state.countries.TURKMENISTAN.turkmenistanMineralsReceived, 3);
  assert.equal(state.countries.TURKMENISTAN.gasUnlocked, true);
  assert.equal(state.countries.TURKMENISTAN.gasUnlockRound, 2);
});

test('Ethiopia Water Control hits Egypt; Egypt Stop Ethiopia reverses it', () => {
  const state = freshActiveState();
  const egyptWaterBefore = state.countries.EGYPT.resources.water;
  const egyptPowerBefore = state.countries.EGYPT.resources.power;
  const ethiopiaWaterBefore = state.countries.ETHIOPIA.resources.water;

  const use = useSpecialMove(state, 'ETHIOPIA', {});
  assert.ok(use.ok, use.reason);
  assert.equal(state.countries.EGYPT.resources.water, 0);
  assert.equal(state.countries.EGYPT.resources.power, 0);
  assert.equal(state.countries.ETHIOPIA.resources.water, ethiopiaWaterBefore + 2);

  const stop = useSpecialMove(state, 'EGYPT', {});
  assert.ok(stop.ok, stop.reason);
  assert.equal(state.countries.EGYPT.resources.water, egyptWaterBefore);
  assert.equal(state.countries.EGYPT.resources.power, egyptPowerBefore);
  assert.equal(state.countries.ETHIOPIA.resources.water, ethiopiaWaterBefore);
});

test('Laos Emergency Release zeroes Thailand power; Backup Plan protects Thailand only', () => {
  const state = freshActiveState();
  const laosPowerBefore = state.countries.LAOS.resources.power; // after normal transfer already applied
  const thailandPowerBefore = state.countries.THAILAND.resources.power; // 1 (received transfer)

  const use = useSpecialMove(state, 'LAOS', {});
  assert.ok(use.ok, use.reason);
  // Laos: +2 bonus, +1 clawed back from the transfer = +3 total
  assert.equal(state.countries.LAOS.resources.power, laosPowerBefore + 3);
  assert.equal(state.countries.THAILAND.resources.power, thailandPowerBefore - 1); // lost the transferred 1

  const backup = useSpecialMove(state, 'THAILAND', {});
  assert.ok(backup.ok, backup.reason);
  assert.equal(state.countries.THAILAND.resources.power, thailandPowerBefore); // restored
  assert.equal(state.countries.LAOS.resources.power, laosPowerBefore + 3); // Laos keeps its gain
});

test('Laos cannot use Emergency Release during the Round 2 Mekong Drought', () => {
  const state = createInitialState();
  state.round = 2;
  state.phase = 'active';
  const powerBefore = state.countries.LAOS.resources.power;

  const use = useSpecialMove(state, 'LAOS', {});
  assert.equal(use.ok, false);
  assert.match(use.reason, /Mekong Drought/);
  assert.equal(state.countries.LAOS.resources.power, powerBefore); // untouched
  assert.equal(state.countries.LAOS.specialMove.usesLeft, 2); // not consumed
});

test('Turkmenistan Block It nullifies Venezuela Claim New Land', () => {
  const state = freshActiveState();
  const oilBefore = state.countries.VENEZUELA.resources.oil;
  useSpecialMove(state, 'VENEZUELA', {});
  assert.equal(state.countries.VENEZUELA.resources.oil, oilBefore + 3);
  const logEntry = state.specialMoveLog.find((e) => e.moveId === 'CLAIM_NEW_LAND');
  const block = useSpecialMove(state, 'TURKMENISTAN', { targetLogId: logEntry.id });
  assert.ok(block.ok, block.reason);
  assert.equal(state.countries.VENEZUELA.resources.oil, oilBefore);
});

test('Bolivia Take It Back reverses its most recent outgoing trade', () => {
  const state = freshActiveState();
  const bolMineralBefore = state.countries.BOLIVIA.resources.mineral;
  const canMineralBefore = state.countries.CANADA.resources.mineral;
  const propose = proposeTrade(state, { from: 'BOLIVIA', to: 'CANADA', give: { resource: 'mineral', qty: 2 }, want: { resource: 'oil', qty: 0 } });
  acceptTrade(state, propose.offer.id, 'CANADA');
  assert.equal(state.countries.BOLIVIA.resources.mineral, bolMineralBefore - 2);
  assert.equal(state.countries.CANADA.resources.mineral, canMineralBefore + 1); // 2 sent - 1 passive

  const takeBack = useSpecialMove(state, 'BOLIVIA', {});
  assert.ok(takeBack.ok, takeBack.reason);
  assert.equal(state.countries.BOLIVIA.resources.mineral, bolMineralBefore);
  assert.equal(state.countries.CANADA.resources.mineral, canMineralBefore);
});

test('A Special Move can only be used once per round, even with uses left', () => {
  const state = freshActiveState();
  const first = useSpecialMove(state, 'ETHIOPIA', {});
  assert.ok(first.ok, first.reason);
  assert.equal(state.countries.ETHIOPIA.specialMove.usesLeft, 2); // 3 max, 1 used

  const second = useSpecialMove(state, 'ETHIOPIA', {});
  assert.equal(second.ok, false);
  assert.match(second.reason, /once per round/);
  assert.equal(state.countries.ETHIOPIA.specialMove.usesLeft, 2); // unchanged, blocked before it ran

  lockAndScoreRound(state);
  nextRound(state);
  revealEvent(state);
  startTimer(state);
  const thirdRoundUse = useSpecialMove(state, 'ETHIOPIA', {});
  assert.ok(thirdRoundUse.ok, thirdRoundUse.reason); // allowed again next round
});

test('Canada Quick Swap trades 1 resource for 1 other, no other country involved', () => {
  const state = freshActiveState();
  const oilBefore = state.countries.CANADA.resources.oil;
  const waterBefore = state.countries.CANADA.resources.water;
  const swap = useSpecialMove(state, 'CANADA', { giveResource: 'oil', receiveResource: 'water' });
  assert.ok(swap.ok, swap.reason);
  assert.equal(state.countries.CANADA.resources.oil, oilBefore - 1);
  assert.equal(state.countries.CANADA.resources.water, waterBefore + 1);
});

test('Build for the Future: cost escalates 1 -> 2 -> 3 and applies next round', () => {
  const state = freshActiveState();
  const canada = state.countries.CANADA;
  canada.resources.mineral = 10;
  canada.resources.power = 10;

  const r1 = buildForFuture(state, 'CANADA', 'food');
  assert.ok(r1.ok, r1.reason);
  assert.equal(r1.cost, 1);
  assert.equal(canada.resources.mineral, 9);
  assert.equal(canada.resources.power, 9);

  const again = buildForFuture(state, 'CANADA', 'food');
  assert.equal(again.ok, false); // only once per round

  lockAndScoreRound(state); // Track A also consumes Canada's food stock (requirement met)
  nextRound(state);
  revealEvent(state); // round 2
  startTimer(state); // applies round-2 production including the +1 food bonus
  // stockpile was consumed to 0 by Track A, then base food 1 + bonus 1 = 2
  assert.equal(canada.resources.food, 2);

  const r2 = buildForFuture(state, 'CANADA', 'food');
  assert.ok(r2.ok, r2.reason);
  assert.equal(r2.cost, 2);
});

test('Track A: sufficient resources score +3 and consume; insufficient score -3 and keep', () => {
  const state = freshActiveState();
  const eth = state.countries.ETHIOPIA;
  // Ethiopia (lower tier req 1/1/1) starts with 0 oil/gas, 3 water, 1 food after round-1 production.
  const results = applyTrackA(state);
  assert.equal(results.ETHIOPIA.energyOk, false); // 0 energy < 1
  assert.equal(eth.score, -3 + 3 + 3); // energy fail, water ok, food ok
  assert.equal(eth.resources.water, 3 - 1);
  assert.equal(eth.resources.food, 1 - 1);
});

test('Round 6 event permanently raises upper-group requirements', () => {
  const state = createInitialState();
  state.round = 6;
  revealEvent(state);
  assert.equal(state.flags.upperGroupReqUpgraded, true);
  const req = getRequirement('CANADA', 6, state);
  assert.deepEqual(req, { energy: 3, water: 2, food: 2 });
  const lowerReq = getRequirement('BOLIVIA', 6, state);
  assert.deepEqual(lowerReq, { energy: 1, water: 1, food: 1 });
});

test('Round 5/8 requirement bumps stay hidden until the event is revealed', () => {
  const state = createInitialState();
  state.round = 5;
  // Before Reveal Event: requirement should NOT yet show the Food Prices Spike bump.
  assert.deepEqual(getRequirement('CANADA', 5, state), { energy: 2, water: 1, food: 1 });
  revealEvent(state);
  // After Reveal Event: the +1 Food is now visible (and this is what Track A will use).
  assert.deepEqual(getRequirement('CANADA', 5, state), { energy: 2, water: 1, food: 2 });

  const state8 = createInitialState();
  state8.round = 8;
  assert.deepEqual(getRequirement('BOLIVIA', 8, state8), { energy: 1, water: 1, food: 1 });
  revealEvent(state8);
  assert.deepEqual(getRequirement('BOLIVIA', 8, state8), { energy: 1, water: 2, food: 1 });
});

test('Round 4 -> 5 transition grants Canada/Laos permanent +1 Power', () => {
  const state = createInitialState();
  state.round = 4;
  state.phase = 'locked';
  const next = nextRound(state);
  assert.ok(next.ok, next.reason);
  assert.equal(state.round, 5);
  assert.equal(state.flags.canadaLaosPowerBonus, true);
  const prodCanada = state.countries.CANADA;
  revealEvent(state);
  startTimer(state);
  assert.equal(prodCanada.resources.power, 1 + 1); // base 1 + bonus 1
});

test('Round 7 energy price war: seller sends 2, buyer receives 1', () => {
  const state = createInitialState();
  state.round = 7;
  state.phase = 'active';
  state.countries.CANADA.resources.oil = 10;
  const propose = proposeTrade(state, { from: 'CANADA', to: 'ETHIOPIA', give: { resource: 'oil', qty: 4 }, want: { resource: 'water', qty: 0 } });
  assert.ok(propose.ok, propose.reason);
  const ethBefore = state.countries.ETHIOPIA.resources.oil;
  const accept = acceptTrade(state, propose.offer.id, 'ETHIOPIA');
  assert.ok(accept.ok, accept.reason);
  assert.equal(state.countries.CANADA.resources.oil, 6); // full 4 sent
  assert.equal(state.countries.ETHIOPIA.resources.oil, ethBefore + 2); // floor(4/2)
});

test('Round 9: trading closes into voting (no scoring yet), then Reveal Event, then vote, then Reveal Results actually scores', () => {
  const state = createInitialState();
  state.round = 9;
  state.phase = 'active';
  for (const code of Object.keys(state.countries)) {
    state.countries[code].resources.oil = 5;
    state.countries[code].resources.gas = 5;
    state.countries[code].resources.water = 5;
    state.countries[code].resources.food = 5;
  }
  const codes = Object.keys(state.countries);

  // Voting isn't open yet — trading just closed.
  const tooEarlyVote = submitRound9Choice(state, codes[0], 'comply');
  assert.equal(tooEarlyVote.ok, false);
  const tooEarlyReveal = revealRound9Results(state);
  assert.equal(tooEarlyReveal.ok, false);

  const lockResult = lockTradingRound9(state);
  assert.ok(lockResult.ok, lockResult.reason);
  assert.equal(state.phase, 'voting');

  // Still can't vote or reveal results until the event itself is revealed.
  assert.equal(submitRound9Choice(state, codes[0], 'comply').ok, false);
  assert.equal(revealRound9Results(state).ok, false);

  const reveal = revealEvent(state);
  assert.ok(reveal.ok, reveal.reason);

  codes.slice(0, 6).forEach((c) => submitRound9Choice(state, c, 'comply'));
  codes.slice(6).forEach((c) => submitRound9Choice(state, c, 'ignore'));

  const complier = state.countries[codes[0]];
  const ignorer = state.countries[codes[6]];
  assert.equal(complier.score, 0); // nothing scored yet — still in voting phase
  assert.equal(ignorer.score, 0);

  const results = revealRound9Results(state);
  assert.ok(results.ok, results.reason);
  assert.equal(state.phase, 'locked'); // this is what finally locks the round
  assert.equal(results.complyCount, 6);
  assert.equal(results.bonusGranted, true);
  // Complier has 5 oil + 5 gas (way more than any energy requirement) but still fails
  // energy and takes -3, because Comply means abstaining regardless of actual holdings.
  assert.equal(complier.score, -3 + 3 + 3 + 3); // energy fails, water/food ok, +3 group bonus
  assert.equal(ignorer.score, 3 + 3 + 3 + 3); // energy/water/food all ok, +3 group bonus too
});

test('Round 10 Battery Boom scores exactly when Reveal Event is clicked, using final holdings', () => {
  const state = createInitialState();
  state.round = 10;
  state.phase = 'active';
  // Enough oil/water/food to pass Track A too (Bolivia is lower-tier: needs 1 of each),
  // isolating the Battery Boom delta from the round's normal +9/-9 Track A swing.
  state.countries.BOLIVIA.resources.oil = 1;
  state.countries.BOLIVIA.resources.water = 1;
  state.countries.BOLIVIA.resources.food = 1;
  state.countries.BOLIVIA.resources.mineral = 5;
  const scoreBefore = state.countries.BOLIVIA.score;

  lockAndScoreRound(state); // 20 minutes are "over" — Track A runs (+9), no Battery Boom yet
  assert.equal(state.countries.BOLIVIA.score, scoreBefore + 9);

  const reveal = revealEvent(state); // score changes exactly now
  assert.ok(reveal.ok, reveal.reason);
  assert.equal(state.countries.BOLIVIA.score, scoreBefore + 9 + 5);
  assert.equal(state.countries.BOLIVIA.resources.mineral, 5); // not consumed
});

test('Start Timer requires the round event to be revealed first', () => {
  const state = createInitialState();
  const tooEarly = startTimer(state);
  assert.equal(tooEarly.ok, false);
  assert.equal(state.phase, 'setup');
  assert.equal(state.timer.running, false);

  revealEvent(state);
  const afterReveal = startTimer(state);
  assert.ok(afterReveal.ok, afterReveal.reason);
  assert.equal(state.phase, 'active');
});

test('Rounds 9 and 10 can both Start Timer with no announcement', () => {
  const state9 = createInitialState();
  state9.round = 9;
  const result9 = startTimer(state9);
  assert.ok(result9.ok, result9.reason);
  assert.equal(state9.phase, 'active');
  assert.equal(state9.eventRevealed, false);

  const state10 = createInitialState();
  state10.round = 10;
  const result10 = startTimer(state10);
  assert.ok(result10.ok, result10.reason);
  assert.equal(state10.phase, 'active');
  assert.equal(state10.eventRevealed, false);
});

test('Round 10 Reveal Event only unlocks after the round locks', () => {
  const state = createInitialState();
  state.round = 10;
  startTimer(state);

  const tooEarly = revealEvent(state);
  assert.equal(tooEarly.ok, false);
  assert.match(tooEarly.reason, /after the timer reaches 0/);

  lockAndScoreRound(state);
  const afterLock = revealEvent(state);
  assert.ok(afterLock.ok, afterLock.reason);
  assert.equal(state.eventRevealed, true);
});

test('Round 9 tickTimer/forceEndRound move into voting, not straight to locked', () => {
  const state = createInitialState();
  state.round = 9;
  startTimer(state);
  state.timer.endsAt = Date.now() - 1000; // simulate the clock having run out

  const justEnded = tickTimer(state);
  assert.equal(justEnded, true);
  assert.equal(state.phase, 'voting'); // not 'locked' — no scoring yet

  const state2 = createInitialState();
  state2.round = 9;
  startTimer(state2);
  const forced = forceEndRound(state2);
  assert.ok(forced.ok, forced.reason);
  assert.equal(state2.phase, 'voting');
});

test('Next Round is blocked on Round 9 until results are revealed', () => {
  const state = createInitialState();
  state.round = 9;
  state.phase = 'active';
  lockTradingRound9(state);
  revealEvent(state);
  for (const code of Object.keys(state.countries)) submitRound9Choice(state, code, 'ignore');

  // Still in 'voting' — Track A hasn't run yet, so the round isn't locked at all.
  const tooEarly = nextRound(state);
  assert.equal(tooEarly.ok, false);
  assert.equal(state.round, 9); // unchanged

  revealRound9Results(state);
  const afterReveal = nextRound(state);
  assert.ok(afterReveal.ok, afterReveal.reason);
  assert.equal(state.round, 10);
});

test('Time machine: restore brings back exact resources/score and drops later checkpoints', () => {
  const store = new Map(); // isolated store, independent of the shared default one
  const state = freshActiveState(); // round 1, active, production applied

  recordSnapshot(state, store);
  assert.deepEqual(listSnapshotRounds(store), [1]);

  // Simulate round 1 play, then advance and simulate round 2 play.
  state.countries.CANADA.score = 100;
  state.countries.CANADA.resources.oil = 999;
  state.round = 2;
  recordSnapshot(state, store);
  state.countries.CANADA.score = 200;
  assert.deepEqual(listSnapshotRounds(store), [1, 2]);

  const restore = restoreSnapshot(state, 1, store);
  assert.ok(restore.ok, restore.reason);
  assert.equal(state.round, 1);
  assert.equal(state.countries.CANADA.score, 0); // back to round-1 checkpoint values
  assert.equal(state.countries.CANADA.resources.oil, 1); // Canada's round-1 base production
  assert.equal(state.timer.running, false); // never resumes a running clock

  // Round 2's checkpoint is gone — that future no longer exists.
  assert.deepEqual(listSnapshotRounds(store), [1]);

  const missing = restoreSnapshot(state, 2, store);
  assert.equal(missing.ok, false);
});

console.log(`\n${passed} test(s) passed.`);
