// Trade proposal / response engine.
// A trade has two legs: `give` (from -> to) and `want` (to -> from, i.e. what `from` receives back).
// Each leg is validated and resolved independently through the same resource-transfer rules.

const OIL_BAN_ROUND3_COUNTRIES = ['VENEZUELA', 'EGYPT', 'TURKMENISTAN', 'CANADA'];

function oilTradeBlocked(round, sender) {
  if (round === 3 && OIL_BAN_ROUND3_COUNTRIES.includes(sender)) return true;
  if (round === 4 && sender === 'EGYPT') return true; // Egypt's passive extends the ban one round
  return false;
}

// Validates one leg (sender -> receiver, resource, qty) against passives/events.
// Returns { ok: true } or { ok: false, reason }.
export function validateLeg(state, sender, resource, qty) {
  if (qty <= 0) return { ok: true }; // a zero/empty leg is always fine (one-directional gift)

  if (resource === 'oil' && oilTradeBlocked(state.round, sender)) {
    return { ok: false, reason: `${sender} cannot trade Oil this round (Oil Route Blocked).` };
  }

  if (resource === 'food' && sender === 'UKRAINE') {
    const specialDealActive = state.countries.UKRAINE.thisRound.specialDealActiveRound === state.round;
    if (!specialDealActive && qty < 3) {
      return { ok: false, reason: 'Ukraine can only trade Food in groups of 3 or more.' };
    }
  }

  if (resource === 'oil' && sender === 'VENEZUELA') {
    if (state.countries.VENEZUELA.resources.power < 1) {
      return { ok: false, reason: 'Venezuela needs at least 1 Power to trade Oil.' };
    }
  }

  return { ok: true };
}

// Computes how much the receiver actually gets for a leg, after event ratios and passives.
function resolveDeliveredQty(state, sender, resource, qty) {
  let delivered = qty;
  if (state.round === 7 && (resource === 'oil' || resource === 'gas')) {
    delivered = Math.floor(delivered / 2); // Energy Price War: seller sends 2 for buyer to get 1
  }
  if (sender === 'BOLIVIA') {
    delivered = Math.max(0, delivered - 1);
  }
  return delivered;
}

function executeLeg(state, sender, receiver, resource, qty) {
  if (qty <= 0) return 0;
  const delivered = resolveDeliveredQty(state, sender, resource, qty);
  state.countries[sender].resources[resource] -= qty;
  state.countries[receiver].resources[resource] += delivered;

  if (resource === 'mineral' && receiver === 'TURKMENISTAN') {
    const tkm = state.countries.TURKMENISTAN;
    if (!tkm.gasUnlocked) {
      tkm.turkmenistanMineralsReceived += delivered;
      if (tkm.turkmenistanMineralsReceived >= 3) {
        tkm.gasUnlocked = true;
        tkm.gasUnlockRound = state.round + 1;
      }
    }
  }
  return delivered;
}

export function proposeTrade(state, { from, to, give, want }) {
  if (from === to) return { ok: false, reason: 'Cannot trade with yourself.' };
  if (state.phase !== 'active') return { ok: false, reason: 'Trading is not open right now.' };

  const giveResource = give?.resource ?? null;
  const giveQty = Number(give?.qty) || 0;
  const wantResource = want?.resource ?? null;
  const wantQty = Number(want?.qty) || 0;

  if (!giveResource && !wantResource) return { ok: false, reason: 'Offer must include at least one resource.' };
  if (giveQty > 0 && state.countries[from].resources[giveResource] < giveQty) {
    return { ok: false, reason: `You do not have enough ${giveResource} to offer.` };
  }

  const giveCheck = validateLeg(state, from, giveResource, giveQty);
  if (!giveCheck.ok) return giveCheck;
  const wantCheck = validateLeg(state, to, wantResource, wantQty);
  if (!wantCheck.ok) return wantCheck;

  const offer = {
    id: state.nextOfferId++,
    round: state.round,
    from,
    to,
    give: { resource: giveResource, qty: giveQty },
    want: { resource: wantResource, qty: wantQty },
    status: 'pending',
    counterOf: null,
    createdAt: Date.now(),
  };
  state.trades.offers.push(offer);
  return { ok: true, offer };
}

export function acceptTrade(state, offerId, respondingCountry) {
  const offer = state.trades.offers.find((o) => o.id === offerId);
  if (!offer) return { ok: false, reason: 'Offer not found.' };
  if (offer.status !== 'pending') return { ok: false, reason: 'Offer is no longer pending.' };
  if (offer.to !== respondingCountry) return { ok: false, reason: 'Only the recipient can accept this offer.' };
  if (state.phase !== 'active') return { ok: false, reason: 'Trading is not open right now.' };

  const giveCheck = validateLeg(state, offer.from, offer.give.resource, offer.give.qty);
  if (!giveCheck.ok) return giveCheck;
  const wantCheck = validateLeg(state, offer.to, offer.want.resource, offer.want.qty);
  if (!wantCheck.ok) return wantCheck;

  if (offer.give.qty > 0 && state.countries[offer.from].resources[offer.give.resource] < offer.give.qty) {
    return { ok: false, reason: `${offer.from} no longer has enough ${offer.give.resource}.` };
  }
  if (offer.want.qty > 0 && state.countries[offer.to].resources[offer.want.resource] < offer.want.qty) {
    return { ok: false, reason: `${offer.to} does not have enough ${offer.want.resource}.` };
  }

  const givenDelivered = executeLeg(state, offer.from, offer.to, offer.give.resource, offer.give.qty);
  const wantDelivered = executeLeg(state, offer.to, offer.from, offer.want.resource, offer.want.qty);

  offer.status = 'accepted';
  offer.resolvedAt = Date.now();
  offer.delivered = { give: givenDelivered, want: wantDelivered };
  state.trades.history.push({ ...offer });

  return { ok: true, offer };
}

export function rejectTrade(state, offerId, respondingCountry) {
  const offer = state.trades.offers.find((o) => o.id === offerId);
  if (!offer) return { ok: false, reason: 'Offer not found.' };
  if (offer.status !== 'pending') return { ok: false, reason: 'Offer is no longer pending.' };
  if (offer.to !== respondingCountry) return { ok: false, reason: 'Only the recipient can reject this offer.' };

  offer.status = 'rejected';
  offer.resolvedAt = Date.now();
  state.trades.history.push({ ...offer });
  return { ok: true, offer };
}

export function counterTrade(state, offerId, respondingCountry, { give, want }) {
  const original = state.trades.offers.find((o) => o.id === offerId);
  if (!original) return { ok: false, reason: 'Offer not found.' };
  if (original.status !== 'pending') return { ok: false, reason: 'Offer is no longer pending.' };
  if (original.to !== respondingCountry) return { ok: false, reason: 'Only the recipient can counter this offer.' };

  original.status = 'countered';
  original.resolvedAt = Date.now();
  state.trades.history.push({ ...original });

  // Counter-offer is a fresh proposal from the original recipient back to the original sender,
  // with give/want swapped in perspective (the counter-proposer defines their own give/want).
  const result = proposeTrade(state, { from: respondingCountry, to: original.from, give, want });
  if (!result.ok) return result;
  result.offer.counterOf = original.id;
  return result;
}
