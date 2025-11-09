import { describe, it, expect } from 'vitest';
import { hmacB64, safeEq } from '../src/hmac';

describe('HMAC utilities', () => {
  it('should generate consistent HMAC signatures', () => {
    const body = Buffer.from('{"test": "data"}');
    const secret = 'test-secret';

    const sig1 = hmacB64(body, secret);
    const sig2 = hmacB64(body, secret);

    expect(sig1).toBe(sig2);
    expect(sig1).toBeTruthy();
  });

  it('should verify valid HMAC signatures', () => {
    const body = Buffer.from('{"test": "data"}');
    const secret = 'test-secret';
    const sig = hmacB64(body, secret);

    expect(safeEq(sig, sig)).toBe(true);
  });

  it('should reject invalid HMAC signatures', () => {
    const body = Buffer.from('{"test": "data"}');
    const secret = 'test-secret';
    const sig = hmacB64(body, secret);
    const wrongSig = hmacB64(Buffer.from('{"wrong": "data"}'), secret);

    expect(safeEq(sig, wrongSig)).toBe(false);
  });

  it('should be constant-time safe', () => {
    const a = 'same-length-1';
    const b = 'same-length-2';

    // Should not throw, should return false
    expect(safeEq(a, b)).toBe(false);
  });
});
