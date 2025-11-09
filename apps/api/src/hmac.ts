import crypto from 'node:crypto';
import { decryptSecret } from './hmac-secrets.js';

/**
 * Generate HMAC-SHA256 signature for a body
 */
export function hmacB64(body: Buffer | string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64');
}

/**
 * Constant-time string comparison
 */
export function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verify HMAC signature for an API key
 */
export function verifyHmac(raw: Buffer, sig: string, apiKey: any): boolean {
  try {
    const secret = decryptSecret(apiKey.secret);
    const expected = hmacB64(raw, secret);
    return safeEq(expected, sig);
  } catch (error) {
    return false;
  }
}
