import { afterEach, describe, expect, it } from 'vitest';
import {
  generateQrSecret,
  generateShortCode,
  hashQrValue,
  isQrSecret,
  normalizeShortCode,
} from '../convex/qrCrypto';

const originalPepper = process.env.QR_TOKEN_PEPPER;

afterEach(() => {
  if (originalPepper === undefined) delete process.env.QR_TOKEN_PEPPER;
  else process.env.QR_TOKEN_PEPPER = originalPepper;
});

describe('QR token cryptography', () => {
  it('generates non-repeating URL-safe secrets', () => {
    const first = generateQrSecret();
    const second = generateQrSecret();
    expect(first).not.toBe(second);
    expect(isQrSecret(first)).toBe(true);
    expect(isQrSecret(second)).toBe(true);
  });

  it('generates readable normalized short codes', () => {
    const code = generateShortCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/);
    expect(normalizeShortCode(` ${code.slice(0, 4)}-${code.slice(4)} `)).toBe(code);
  });

  it('hashes values with a server-side pepper', async () => {
    process.env.QR_TOKEN_PEPPER = 'a-secure-test-pepper-that-is-longer-than-32-chars';
    await expect(hashQrValue('secret')).resolves.toMatch(/^[A-Za-z0-9_-]+$/);
    await expect(hashQrValue('secret')).resolves.toBe(await hashQrValue('secret'));
    await expect(hashQrValue('other')).resolves.not.toBe(await hashQrValue('secret'));
  });

  it('fails closed without a strong pepper', async () => {
    delete process.env.QR_TOKEN_PEPPER;
    await expect(hashQrValue('secret')).rejects.toThrow('qr_token_pepper_unavailable');
  });
});
