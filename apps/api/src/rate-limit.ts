import IORedis from 'ioredis';

const redis = process.env.REDIS_URL ? new IORedis(process.env.REDIS_URL) : null;

// Fallback to in-memory if Redis not available
const localCache = new Map<string, { count: number; resetAt: number }>();

/**
 * Per-tenant rate limiting
 * Uses Redis if available, falls back to in-memory
 */
export async function tenantRateLimit(
  tenantId: string,
  max: number,
  windowMs: number
): Promise<void> {
  const now = Date.now();
  const windowKey = Math.floor(now / windowMs);
  const key = `rl:${tenantId}:${windowKey}`;

  if (redis) {
    // Use Redis for distributed rate limiting
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, windowMs);
    }
    if (count > max) {
      throw new Error('rate_limit_exceeded');
    }
    return;
  }

  // Fallback to local in-memory cache
  const entry = localCache.get(key);
  if (!entry || entry.resetAt < now) {
    localCache.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  entry.count += 1;
  if (entry.count > max) {
    throw new Error('rate_limit_exceeded');
  }
}
