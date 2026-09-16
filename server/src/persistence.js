// Loads/saves the full game (state + round checkpoints) as one JSON blob.
//
// Two backends, chosen automatically:
//   - Redis (Upstash), when UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are set — this
//     is what makes the game survive on a serverless host, where nothing written to local
//     disk survives between requests (each request can run in a fresh container).
//   - A local JSON file, otherwise — zero setup for local development and testing.
//
// Both backends expose the same two functions, so callers never need to know which one
// is active.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HAS_REDIS = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const REDIS_KEY = 'the-table:save';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.SAVE_DIR || path.join(__dirname, '..', 'data');
const SAVE_PATH = path.join(DATA_DIR, 'save.json');

let redisClient = null;
async function getRedis() {
  if (!redisClient) {
    const { Redis } = await import('@upstash/redis');
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}

export async function saveGame(state, snapshots) {
  const payload = JSON.stringify({ savedAt: Date.now(), state, snapshots });
  try {
    if (HAS_REDIS) {
      const redis = await getRedis();
      await redis.set(REDIS_KEY, payload);
    } else {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmpPath = `${SAVE_PATH}.tmp`;
      fs.writeFileSync(tmpPath, payload);
      fs.renameSync(tmpPath, SAVE_PATH); // atomic — a crash mid-write can't corrupt the save
    }
  } catch (err) {
    console.error('[persistence] Failed to save game state:', err.message);
  }
}

// Returns { savedAt, state, snapshots } or null if there's no valid save to load.
export async function loadGame() {
  try {
    let raw;
    if (HAS_REDIS) {
      const redis = await getRedis();
      raw = await redis.get(REDIS_KEY);
      if (raw && typeof raw !== 'string') raw = JSON.stringify(raw); // SDK may auto-parse
    } else {
      if (!fs.existsSync(SAVE_PATH)) return null;
      raw = fs.readFileSync(SAVE_PATH, 'utf-8');
    }
    if (!raw) return null;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed?.state?.countries) return null;
    return parsed;
  } catch (err) {
    console.error('[persistence] Failed to load saved game (starting fresh instead):', err.message);
    return null;
  }
}

export function backendName() {
  return HAS_REDIS ? 'Upstash Redis' : `local file (${SAVE_PATH})`;
}
