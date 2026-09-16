// Local development server — mounts the exact same handlers that run on Vercel in
// production (server/src/handlers/*), so testing locally exercises the real code path.
// No Express, no extra dependencies: plain Node http, since this only needs two routes.
//
// Usage: node server/dev-server.js  (defaults to port 4000, override with PORT env var)

import http from 'http';
import { handleStateRequest } from './src/handlers/stateHandler.js';
import { handleActionRequest } from './src/handlers/actionHandler.js';
import { backendName } from './src/persistence.js';

const PORT = process.env.PORT || 4000;

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  withCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, backend: backendName() }));
    }

    if (url.pathname === '/api/state' && req.method === 'GET') {
      const query = Object.fromEntries(url.searchParams.entries());
      const { status, body } = await handleStateRequest(query);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(body));
    }

    if (url.pathname === '/api/action' && req.method === 'POST') {
      const requestBody = await readJsonBody(req);
      const { status, body } = await handleActionRequest(requestBody);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(body));
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, reason: 'Not found.' }));
  } catch (err) {
    console.error('[dev-server] error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, reason: 'Server error.' }));
  }
});

server.listen(PORT, () => {
  console.log(`THE TABLE dev API server listening on http://localhost:${PORT}`);
  console.log(`Persistence backend: ${backendName()}`);
  console.log(`Admin password: ${process.env.ADMIN_PASSWORD || 'teacher123'}`);
});
