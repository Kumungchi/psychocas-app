import { describe, expect, it } from 'vitest';
import { computeStandaloneMode } from '@/lib/pwa/displayMode';

describe('computeStandaloneMode', () => {
  it('returns true when the standalone media query matches', () => {
    expect(
      computeStandaloneMode({
        matchMediaStandalone: true,
        displayMode: 'browser',
        navigatorStandalone: false,
      })
    ).toBe(true);
  });

  it('accepts standalone-like display modes reported by the browser', () => {
    expect(
      computeStandaloneMode({
        matchMediaStandalone: false,
        displayMode: 'fullscreen',
        navigatorStandalone: false,
      })
    ).toBe(true);

    expect(
      computeStandaloneMode({
        displayMode: 'window-controls-overlay',
      })
    ).toBe(true);
  });

  it('falls back to the iOS navigator.standalone flag when available', () => {
    expect(
      computeStandaloneMode({
        matchMediaStandalone: false,
        navigatorStandalone: true,
      })
    ).toBe(true);
  });

  it('returns false when no standalone indicators are present', () => {
    expect(
      computeStandaloneMode({
        matchMediaStandalone: false,
        displayMode: 'browser',
        navigatorStandalone: false,
      })
    ).toBe(false);

    expect(
      computeStandaloneMode({})
    ).toBe(false);
  });
});
