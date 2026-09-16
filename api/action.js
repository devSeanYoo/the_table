// Vercel serverless entry point — thin wrapper around the framework-agnostic handler in
// server/src/handlers/actionHandler.js. POST /api/action with a JSON body.

import { handleActionRequest } from '../server/src/handlers/actionHandler.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, reason: 'Method not allowed.' });

  try {
    const { status, body } = await handleActionRequest(req.body || {});
    res.status(status).json(body);
  } catch (err) {
    console.error('[api/action] error:', err);
    res.status(500).json({ ok: false, reason: 'Server error.' });
  }
}
