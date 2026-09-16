import { COUNTRY_CODES } from './data/countries.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'teacher123';

// Every request carries its own credentials (there's no persistent connection to
// remember "who you are" between requests, unlike the old Socket.IO version) — so this
// runs on every single state fetch and action.
export function checkAuth(state, { role, password, country, pin }) {
  if (role === 'admin') {
    if (password !== ADMIN_PASSWORD) return { ok: false, reason: 'Wrong password.' };
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
