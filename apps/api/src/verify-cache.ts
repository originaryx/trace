/**
 * JWKS cache for Ed25519 public key verification
 * Caches JWKS for 5 minutes to minimize lookups
 */

interface JWK {
  kty: string;
  crv: string;
  kid: string;
  x: string;
  use?: string;
  alg?: string;
}

interface JWKS {
  keys: JWK[];
}

let jwksCache: { jwks: JWKS; expiresAt: number } | null = null;
const JWKS_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch and cache JWKS
 * Returns cached JWKS if still valid, otherwise fetches fresh
 */
export async function fetchJWKS(jwksUrl?: string): Promise<JWKS> {
  const now = Date.now();

  // Return cached JWKS if still valid
  if (jwksCache && jwksCache.expiresAt > now) {
    return jwksCache.jwks;
  }

  // Fetch fresh JWKS
  const url = jwksUrl || process.env.PEAC_JWKS_URL || 'http://localhost:8787/.well-known/jwks.json';

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'OriginaryTrace/0.1' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`JWKS fetch failed: ${response.status}`);
    }

    const jwks = await response.json() as JWKS;

    // Cache the result
    jwksCache = {
      jwks,
      expiresAt: now + JWKS_TTL_MS,
    };

    return jwks;
  } catch (error) {
    // If fetch fails and we have stale cache, use it
    if (jwksCache) {
      console.warn('JWKS fetch failed, using stale cache:', error);
      return jwksCache.jwks;
    }
    throw error;
  }
}

/**
 * Get public key by kid from JWKS
 */
export async function getPubKeyByKid(kid: string): Promise<Uint8Array> {
  const jwks = await fetchJWKS();
  const key = jwks.keys.find((k) => k.kid === kid);

  if (!key) {
    throw new Error(`Unknown kid: ${kid}`);
  }

  // Convert base64url x coordinate to Uint8Array
  return Buffer.from(key.x, 'base64url');
}

/**
 * Legacy getPubKey for backward compatibility
 */
export function getPubKey(kid: string, fallback: string): Uint8Array {
  return Buffer.from(fallback, 'base64url');
}

export function clearCache(): void {
  jwksCache = null;
}
