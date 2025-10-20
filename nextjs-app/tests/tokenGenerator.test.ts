import { describe, expect, it } from 'vitest';
import { generateTokenCode, isValidTokenFormat } from '../supabase/functions/_shared/token';

describe('generateTokenCode', () => {
  it('produces codes in the expected format', () => {
    for (let i = 0; i < 10; i += 1) {
      const code = generateTokenCode();
      expect(isValidTokenFormat(code)).toBe(true);
    }
  });

  it('uses the provided random implementation when available', () => {
    let seed = 0;
    const deterministicRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const first = generateTokenCode({ random: deterministicRandom });
    seed = 0;
    const second = generateTokenCode({ random: deterministicRandom });

    expect(first).toBe(second);
  });

  it('avoids ambiguous characters', () => {
    const code = generateTokenCode({ random: () => 0.5 });
    expect(code).not.toMatch(/[01ILO]/);
  });
});
