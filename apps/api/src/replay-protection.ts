import IORedis from 'ioredis';
import { createHash } from 'crypto';

const redis = process.env.REDIS_URL ? new IORedis(process.env.REDIS_URL) : null;

// Fallback to in-memory if Redis not available
const localNonces = new Map<string, number>();

/**
 * Replay protection using nonces
 * Uses Redis if available, falls back to in-memory
 *
 * TTL: 5 minutes (300000ms) to match timestamp skew window
 */
export async function checkReplayProtection(
  keyId: string,
  timestamp: number,
  bodyBytes: Buffer
): Promise<boolean> {
  // Generate nonce from keyId + timestamp + body
  const nonce = createHash('sha256')
    .update(`${keyId}:${timestamp}:`)
    .update(bodyBytes)
    .digest('hex');

  const nonceKey = `nx:${nonce}`;
  const ttlMs = 300000; // 5 minutes

  if (redis) {
    // Use Redis with NX (set if not exists) and PX (expire in milliseconds)
    const result = await redis.set(nonceKey, '1', 'PX', ttlMs, 'NX');
    // Redis returns 'OK' if the key was set, null if it already existed
    return result === 'OK';
  }

  // Fallback to local in-memory cache
  const now = Date.now();
  const expiresAt = localNonces.get(nonceKey);

  if (expiresAt && expiresAt > now) {
    // Nonce already exists and hasn't expired = replay attack
    return false;
  }

  // Store nonce with expiration
  localNonces.set(nonceKey, now + ttlMs);

  // Cleanup expired nonces (simple garbage collection)
  if (localNonces.size > 10000) {
    for (const [key, expires] of localNonces.entries()) {
      if (expires <= now) {
        localNonces.delete(key);
      }
    }
  }

  return true;
}
