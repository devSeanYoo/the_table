import { UPPER_GROUP } from '../data/countries.js';

// Track A requirement (energy, water, food) for a country in a given round.
export function getRequirement(country, round, state) {
  const isUpper = UPPER_GROUP.includes(country);
  let energy, water, food;

  if (isUpper && state.flags.upperGroupReqUpgraded) {
    energy = 3; water = 2; food = 2;
  } else if (isUpper) {
    energy = 2; water = 1; food = 1;
  } else {
    energy = 1; water = 1; food = 1;
  }

  // Round 5/8 temporary bumps only take effect once the admin has revealed that round's
  // event — otherwise the requirement box would spoil the surprise before the news does.
  // (Round 6's permanent bump is already gated the same way, via the flag above, which is
  // only set inside revealEvent().) By round-end (when Track A actually runs), the event
  // will always have been revealed under the normal Reveal Event -> Start Timer flow.
  if (state.eventRevealed) {
    // Round 5: Food Prices Spike — everyone +1 Food this round only.
    if (round === 5) food += 1;
    // Thailand passive: food event effect lasts one extra round (round 6 too).
    if (round === 6 && country === 'THAILAND') food += 1;

    // Round 8: Global Drought Warning — everyone +1 Water this round only, Ethiopia immune.
    if (round === 8 && country !== 'ETHIOPIA') water += 1;
  }

  return { energy, water, food };
}
