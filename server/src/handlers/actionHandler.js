import { checkAuth } from '../auth.js';
import { ACTIONS } from '../dispatch.js';
import { recordSnapshot, restoreSnapshot } from '../engine/timeMachine.js';
import { loadCurrentGame, persistGame, jsonResponse } from './shared.js';

// body: { role, password?, country?, pin?, action, payload }
export async function handleActionRequest(body) {
  const { role, password, country, pin, action, payload } = body || {};
  const { state, store, dirty } = await loadCurrentGame();

  const auth = checkAuth(state, { role, password, country, pin });
  if (!auth.ok) return jsonResponse(401, { ok: false, reason: auth.reason });

  // admin:restoreRound needs the per-request snapshot store, so it isn't in the plain
  // ACTIONS table (which only receives `state`).
  if (action === 'admin:restoreRound') {
    if (auth.role !== 'admin') return jsonResponse(403, { ok: false, reason: 'Not authorized.' });
    const result = restoreSnapshot(state, Number(payload?.round), store);
    await persistGame(state, store);
    return jsonResponse(200, result);
  }

  const entry = ACTIONS[action];
  if (!entry) return jsonResponse(400, { ok: false, reason: `Unknown action: ${action}` });
  if (entry.role !== auth.role) return jsonResponse(403, { ok: false, reason: 'Not authorized.' });

  const result = entry.run(state, auth, payload || {});

  if (result?.ok) {
    if (action === 'admin:nextRound') recordSnapshot(state, store); // checkpoint the fresh round
    await persistGame(state, store);
  } else if (dirty) {
    // The action itself failed/was rejected, but loadCurrentGame() may have auto-locked an
    // expired round or created a brand-new game — that still needs to be saved.
    await persistGame(state, store);
  }

  return jsonResponse(200, result);
}
