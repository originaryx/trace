import * as ed from '@noble/ed25519';
import { createHash } from 'crypto';

// Configure SHA-512 for Node.js environment
ed.etc.sha512Sync = (...m) => createHash('sha512').update(Buffer.concat(m as any)).digest();

/**
 * Sign a message with Ed25519
 */
export async function signDetached(
  msg: Uint8Array,
  privRaw32: Uint8Array
): Promise<Uint8Array> {
  return ed.sign(msg, privRaw32);
}

/**
 * Verify an Ed25519 signature
 */
export async function verifyDetached(
  sig: Uint8Array,
  msg: Uint8Array,
  pubRaw32: Uint8Array
): Promise<boolean> {
  return ed.verify(sig, msg, pubRaw32);
}

/**
 * Sign JSON Web Signature (JWS) with Ed25519
 * Returns base64url encoded compact JWS
 */
export async function signJws(
  payload: any,
  privKey: string
): Promise<string> {
  const header = {
    alg: 'EdDSA',
    typ: 'JWT',
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const message = `${encodedHeader}.${encodedPayload}`;

  const privKeyBytes = Buffer.from(privKey, 'base64');
  const signature = await signDetached(
    new TextEncoder().encode(message),
    privKeyBytes
  );

  const encodedSignature = Buffer.from(signature).toString('base64url');
  return `${message}.${encodedSignature}`;
}
