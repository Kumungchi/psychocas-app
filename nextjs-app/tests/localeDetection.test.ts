import { describe, expect, it } from 'vitest';
import { resolveLocaleFromHeader } from '@/lib/i18n/detect';

describe('resolveLocaleFromHeader', () => {
  it('returns the default locale when the header is missing', () => {
    expect(resolveLocaleFromHeader(null)).toBe('cs');
  });

  it('matches locales with quality values', () => {
    expect(resolveLocaleFromHeader('en-US,en;q=0.9,cs;q=0.8')).toBe('en');
  });

  it('matches Czech locales before falling back', () => {
    expect(resolveLocaleFromHeader('cs-CZ,cs;q=0.8,en;q=0.6')).toBe('cs');
  });

  it('falls back to the default when no supported locale is found', () => {
    expect(resolveLocaleFromHeader('de,de-DE;q=0.9')).toBe('cs');
  });
});
