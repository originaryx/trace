import * as ed from '@noble/ed25519';
import { randomBytes } from 'crypto';

/**
 * Generate Ed25519 keypair
 */
export async function keygen(): Promise<{ priv: Uint8Array; pub: Uint8Array }> {
  const priv = randomBytes(32);
  const pub = await ed.getPublicKey(priv);
  return { priv, pub };
}

/**
 * Sign message with Ed25519
 */
export async function sign(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
  return ed.sign(message, privateKey);
}

/**
 * Verify Ed25519 signature
 */
export async function verify(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  return ed.verify(signature, message, publicKey);
}
