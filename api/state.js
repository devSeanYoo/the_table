// Vercel serverless entry point — thin wrapper around the framework-agnostic handler in
// server/src/handlers/stateHandler.js. GET /api/state?role=...&password=...|country=...&pin=...

import { handleStateRequest } from '../server/src/handlers/stateHandler.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { status, body } = await handleStateRequest(req.query || {});
    res.status(status).json(body);
  } catch (err) {
    console.error('[api/state] error:', err);
    res.status(500).json({ ok: false, reason: 'Server error.' });
  }
}
