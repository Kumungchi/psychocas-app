import { describe, expect, it } from 'vitest';
import { isSafeRelativePath, sanitizeRedirect } from '@/lib/navigation/redirect';

describe('redirect helpers', () => {
  describe('isSafeRelativePath', () => {
    it('accepts standard relative paths', () => {
      expect(isSafeRelativePath('/home')).toBe(true);
      expect(isSafeRelativePath('/login?next=/home')).toBe(true);
      expect(isSafeRelativePath('/validate#token')).toBe(true);
    });

    it('rejects empty or malformed values', () => {
      expect(isSafeRelativePath(null)).toBe(false);
      expect(isSafeRelativePath('')).toBe(false);
      expect(isSafeRelativePath('   ')).toBe(false);
      expect(isSafeRelativePath('home')).toBe(false);
      expect(isSafeRelativePath('http://evil.test')).toBe(false);
      expect(isSafeRelativePath('//example.com')).toBe(false);
    });
  });

  describe('sanitizeRedirect', () => {
    it('returns the original path when it is safe', () => {
      expect(sanitizeRedirect('/dashboard')).toBe('/dashboard');
    });

    it('falls back to the default when the path is unsafe', () => {
      expect(sanitizeRedirect('javascript:alert(1)')).toBe('/home');
      expect(sanitizeRedirect('//example.com')).toBe('/home');
      expect(sanitizeRedirect('')).toBe('/home');
    });

    it('trims whitespace before validation', () => {
      expect(sanitizeRedirect('  /stats  ')).toBe('/stats');
    });
  });
});
