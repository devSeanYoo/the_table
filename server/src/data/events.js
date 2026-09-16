// Event content for the public dashboard news feed (English, student-facing).
// Round 1 has no event. Effects are applied programmatically in engine/roundLifecycle.js —
// the `effectSummary` here is only the human-readable text shown to students.

export const EVENTS = {
  2: {
    round: 2,
    title: 'Mekong Drought',
    flavor: "The river is running low. Dams can't make power like before.",
    effectSummary: [
      'Laos makes 0 Power this round (Thailand gets 0 too — no power comes through).',
      "Thailand's Water drops by 1 this round.",
    ],
  },
  3: {
    round: 3,
    title: 'Oil Route Blocked',
    flavor: "Ships full of oil can't get through. Trouble at sea is stopping them.",
    effectSummary: [
      'Venezuela, Egypt, Turkmenistan, and Canada cannot trade Oil this round.',
      "You can still use your own Oil at home — you just can't sell or buy it.",
    ],
  },
  4: {
    round: 4,
    title: 'Clean Energy Boom',
    flavor: 'Solar panels and wind farms are going up fast.',
    effectSummary: ['Canada and Laos make +1 Power every round from now on. This is permanent.'],
  },
  5: {
    round: 5,
    title: 'Food Prices Spike',
    flavor: 'Food costs more everywhere. Everyone needs more just to get by.',
    effectSummary: ['Every country needs 1 more Food than usual this round.'],
  },
  6: {
    round: 6,
    title: 'Rising Expectations',
    flavor: 'People want a better life. Governments raise the bar.',
    effectSummary: [
      'Ethiopia, Egypt, Thailand, and Canada now need more resources every round, for the rest of the game:',
      'Energy: 3 (was 2) · Water: 2 (was 1) · Food: 2 (was 1)',
      'This is permanent. Other countries are not affected.',
    ],
  },
  7: {
    round: 7,
    title: 'Energy Price War',
    flavor: 'Oil and gas sellers are fighting for buyers. Prices are a mess.',
    effectSummary: [
      'Any Oil or Gas trade this round follows a new rule: the seller must send 2 for the buyer to receive 1.',
      'This rule cannot be talked around — it applies no matter what you agree to.',
    ],
  },
  8: {
    round: 8,
    title: 'Global Drought Warning',
    flavor: 'Dry weather is hitting the whole world at once.',
    effectSummary: ['Every country needs 1 more Water than usual this round.'],
  },
  9: {
    round: 9,
    title: 'The Climate Deal',
    flavor: 'World leaders want a deal on oil and gas. Will everyone agree — or will someone cheat?',
    effectSummary: [
      'Trade Oil and Gas as much as you want this round, like normal.',
      'Right before the round ends, every country secretly picks one:',
      'Comply — you agree not to use the Oil and Gas you collected this round to meet your Energy need.',
      'Ignore — you use your Oil and Gas normally, like any other round.',
      'If 6 or more countries Comply: every country gets +3 points — even the ones who picked Ignore.',
      'If 5 or fewer countries Comply: no bonus for anyone. Countries that picked Comply also miss out on their Energy need this round.',
    ],
  },
  10: {
    round: 10,
    title: 'Battery Boom',
    flavor: 'Phones, cars, batteries — the whole world wants Minerals right now.',
    effectSummary: [
      'Every country gets +1 point for every Mineral they currently have, right away.',
      'This is a one-time bonus. It does not use up your Minerals.',
    ],
  },
};
