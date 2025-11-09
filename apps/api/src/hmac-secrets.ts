import crypto from 'node:crypto';

const MASTER_KEY_ENV = process.env.API_SECRET_MASTER_KEY;

if (!MASTER_KEY_ENV) {
  console.warn(
    'WARNING: API_SECRET_MASTER_KEY not set. API key encryption will not work in production.'
  );
}

const MASTER = MASTER_KEY_ENV ? Buffer.from(MASTER_KEY_ENV, 'base64') : Buffer.alloc(32);

/**
 * Encrypt an API key secret using AES-256-GCM
 * Format: [IV(12) | AuthTag(16) | Encrypted(N)]
 */
export function encryptSecret(raw: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER, iv);
  const enc = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * Decrypt an API key secret
 */
export function decryptSecret(stored: string): string {
  const buf = Buffer.from(stored, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

/**
 * Generate a random API secret (256 bits)
 */
export function generateApiSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate a random API key ID
 */
export function generateApiKeyId(): string {
  return `key_${crypto.randomBytes(16).toString('base64url')}`;
}
