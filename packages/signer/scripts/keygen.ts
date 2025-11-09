#!/usr/bin/env tsx
/**
 * Generate Ed25519 keypair for PEAC receipts
 * Usage: tsx packages/signer/scripts/keygen.ts
 */

import * as ed from '@noble/ed25519';
import { randomBytes } from 'crypto';

async function main() {
  console.log('Generating Ed25519 keypair...\n');

  const privateKey = randomBytes(32);
  const publicKey = await ed.getPublicKey(privateKey);

  const toBase64Url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');

  const privB64 = toBase64Url(privateKey);
  const pubB64 = toBase64Url(publicKey);

  console.log('Add these to your apps/api/.env file:\n');
  console.log(`PEAC_JWS_PRIVATE=${privB64}`);
  console.log(`PEAC_JWS_PUBLIC=${pubB64}`);
  console.log(`PEAC_JWS_KID=peac-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);

  console.log('\n✅ Keypair generated successfully!');
  console.log('⚠️  Keep PEAC_JWS_PRIVATE secret - never commit to git');
}

main().catch((error) => {
  console.error('Error generating keypair:', error);
  process.exit(1);
});
