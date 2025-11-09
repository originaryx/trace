import { describe, it, expect } from 'vitest';
import { signDetached, verifyDetached } from '../src/eddsa';
import { randomBytes } from 'crypto';
import * as ed from '@noble/ed25519';

describe('Ed25519 signatures', () => {
  it('should sign and verify messages correctly', async () => {
    const privateKey = randomBytes(32);
    const publicKey = await ed.getPublicKey(privateKey);
    const message = Buffer.from('Hello, Originary Trace!');

    const signature = await signDetached(message, privateKey);
    const isValid = await verifyDetached(signature, message, publicKey);

    expect(isValid).toBe(true);
  });

  it('should reject invalid signatures', async () => {
    const privateKey = randomBytes(32);
    const publicKey = await ed.getPublicKey(privateKey);
    const message = Buffer.from('Hello, Originary Trace!');
    const wrongMessage = Buffer.from('Wrong message');

    const signature = await signDetached(message, privateKey);
    const isValid = await verifyDetached(signature, wrongMessage, publicKey);

    expect(isValid).toBe(false);
  });

  it('should reject signatures from wrong key', async () => {
    const privateKey1 = randomBytes(32);
    const privateKey2 = randomBytes(32);
    const publicKey2 = await ed.getPublicKey(privateKey2);
    const message = Buffer.from('Hello, Originary Trace!');

    const signature = await signDetached(message, privateKey1);
    const isValid = await verifyDetached(signature, message, publicKey2);

    expect(isValid).toBe(false);
  });
});
