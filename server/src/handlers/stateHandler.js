import { checkAuth } from '../auth.js';
import { publicView, adminView, countryView } from '../views.js';
import { listSnapshotRounds } from '../engine/timeMachine.js';
import { loadCurrentGame, persistGame, jsonResponse } from './shared.js';

// query: { role, password?, country?, pin? }
export async function handleStateRequest(query) {
  const { state, store, dirty } = await loadCurrentGame();

  const auth = checkAuth(state, query);
  if (!auth.ok) return jsonResponse(401, { ok: false, reason: auth.reason });

  if (dirty) await persistGame(state, store);

  if (auth.role === 'admin') {
    return jsonResponse(200, { ok: true, view: adminView(state, listSnapshotRounds(store)) });
  }
  if (auth.role === 'country') {
    return jsonResponse(200, {
      ok: true,
      public: publicView(state),
      country: countryView(state, auth.country),
    });
  }
  // dashboard
  return jsonResponse(200, { ok: true, view: publicView(state) });
}
