import { getRequirement } from './requirements.js';

// Track A: survival judging for Energy (Oil+Gas), Water, and Food — run once per round,
// when the timer reaches zero. Round 9 "Comply" countries do not count their Oil/Gas
// toward Energy this round (they abstain), independent of the group vote outcome.
export function applyTrackA(state) {
  const results = {};

  for (const code of Object.keys(state.countries)) {
    const cs = state.countries[code];
    const req = getRequirement(code, state.round, state);

    const isComply = state.round === 9 && cs.round9Choice === 'comply';
    const energyAvailable = isComply ? 0 : cs.resources.oil + cs.resources.gas;

    const energyOk = energyAvailable >= req.energy;
    const waterOk = cs.resources.water >= req.water;
    const foodOk = cs.resources.food >= req.food;

    if (energyOk) {
      cs.score += 3;
      let remaining = req.energy;
      const fromOil = Math.min(cs.resources.oil, remaining);
      cs.resources.oil -= fromOil;
      remaining -= fromOil;
      cs.resources.gas -= remaining;
    } else {
      cs.score -= 3;
    }

    if (waterOk) {
      cs.score += 3;
      cs.resources.water -= req.water;
    } else {
      cs.score -= 3;
    }

    if (foodOk) {
      cs.score += 3;
      cs.resources.food -= req.food;
    } else {
      cs.score -= 3;
    }

    results[code] = { req, energyOk, waterOk, foodOk, isComply };
  }

  return results;
}
