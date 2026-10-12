import { COUNTRY_CODES } from './data/countries.js';

// No built-in default: whoever runs the game sets ADMIN_PASSWORD (the local dev server
// generates a random one at startup if it's missing). Read on every call so the dev
// server can set it after this module loads.
function adminPassword() {
  return process.env.ADMIN_PASSWORD || '';
}

// Every request carries its own credentials (there's no persistent connection to
// remember "who you are" between requests, unlike the old Socket.IO version) — so this
// runs on every single state fetch and action.
export function checkAuth(state, { role, password, country, pin }) {
  if (role === 'admin') {
    const expected = adminPassword();
    if (!expected) return { ok: false, reason: 'Admin login is off: set ADMIN_PASSWORD on the server.' };
    if (password !== expected) return { ok: false, reason: 'Wrong password.' };
    return { ok: true, role: 'admin' };
  }
  if (role === 'dashboard') {
    return { ok: true, role: 'dashboard' };
  }
  if (role === 'country') {
    if (!COUNTRY_CODES.includes(country)) return { ok: false, reason: 'Unknown country.' };
    if (String(pin ?? '') !== state.countries[country].accessPin) {
      return { ok: false, reason: 'Incorrect PIN for this country.' };
    }
    return { ok: true, role: 'country', country };
  }
  return { ok: false, reason: 'Unknown role.' };
}
