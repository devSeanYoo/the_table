import { COUNTRIES, COUNTRY_CODES, RESOURCES } from './data/countries.js';

const TIMER_SECONDS = Number(process.env.TIMER_SECONDS) || 20 * 60;

function emptyResources() {
  const r = {};
  for (const key of RESOURCES) r[key] = 0;
  return r;
}

export function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4-digit, no leading zero issues
}

function initCountryState(code) {
  const def = COUNTRIES[code];
  return {
    code,
    accessPin: generatePin(), // hand this out to the team so other teams can't open their page
    resources: emptyResources(),
    score: 0,
    specialMove: {
      usesLeft: def.specialMove.usesMax,
      usedThisRound: false, // at most one use of your Special Move per round, regardless of usesLeft
      usedLog: [], // { round, cancelled }
    },
    reinvest: {
      countUsed: 0, // determines next cost (n = countUsed + 1)
      usedThisRound: false,
      history: [], // { round, resource, cost }
    },
    turkmenistanMineralsReceived: 0,
    gasUnlocked: false,
    gasUnlockRound: null,
    permanentBonuses: emptyResources(), // from Build for the Future, applied starting the round after purchase
    thisRound: {
      emergencyReleaseUsed: false,
      backupPlanUsed: false,
      stopEthiopiaAvailable: false,
      waterControlTargetedEgypt: false, // set true when Ethiopia uses Water Control, cleared/consumed on reaction window close
      quickSwapUsed: 0,
      specialDealActiveRound: null,
    },
    round9Choice: null, // 'comply' | 'ignore' | null
  };
}

export function createInitialState() {
  const countries = {};
  for (const code of COUNTRY_CODES) countries[code] = initCountryState(code);

  return {
    round: 1,
    phase: 'setup', // setup -> event -> active -> locked -> ended (per round) -> game_over
    timer: {
      totalSeconds: TIMER_SECONDS,
      remainingSeconds: TIMER_SECONDS,
      running: false,
      endsAt: null, // epoch ms when running
    },
    eventRevealed: false,
    laosTransferAmountThisRound: 0,
    flags: {
      canadaLaosPowerBonus: false,
      upperGroupReqUpgraded: false,
    },
    countries,
    trades: {
      offers: [], // { id, round, from, to, give:{resource,qty}, want:{resource,qty}, status, counterOf, createdAt }
      history: [],
    },
    news: [], // { id, round, text, ts }
    specialMoveLog: [], // { id, round, country, moveId, targetCountry, ts, cancelled, cancelledBy }
    round9: {
      revealed: false,
      resultApplied: false,
      complyCount: null,
      bonusGranted: null,
    },
    adminLog: [], // { ts, action, detail }
    pendingReinvestBonuses: [], // { country, resource, effectiveRound }
    _productionAppliedForRound: 0,
    nextOfferId: 1,
    nextNewsId: 1,
    nextLogId: 1,
  };
}
