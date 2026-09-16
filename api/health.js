// Temporary diagnostic endpoint — GET /api/health
// Reports whether Redis env vars are visible to this deployment, and does an isolated
// round-trip write/read against a separate test key (never touches the real game save).

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const hasUrl = Boolean(process.env.UPSTASH_REDIS_REST_URL);
  const hasToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
  const report = { hasUpstashUrl: hasUrl, hasUpstashToken: hasToken };

  if (hasUrl && hasToken) {
    try {
      const { Redis } = await import('@upstash/redis');
      const redis = Redis.fromEnv();
      const testKey = 'the-table:healthcheck';
      const testValue = `ok-${Date.now()}`;
      await redis.set(testKey, testValue);
      const readBack = await redis.get(testKey);
      report.redisRoundTrip = readBack === testValue ? 'success' : `mismatch: wrote ${JSON.stringify(testValue)}, read back ${JSON.stringify(readBack)}`;
    } catch (err) {
      report.redisError = err.message;
    }
  } else {
    report.redisRoundTrip = 'skipped — missing env var(s), would fall back to local file (which does not persist on Vercel)';
  }

  res.status(200).json(report);
}
