import { describe, expect, it } from 'vitest';
import {
  INSTALL_OFFER_COOLDOWN_MS,
  detectInstallBrowser,
  detectInstallPlatform,
  isLikelyMobileInstallDevice,
  shouldAutoOfferInstall,
} from '@/lib/pwa/installOffer';

describe('PWA install offer', () => {
  it('detects iOS, iPadOS, Android, and desktop browsers', () => {
    expect(
      detectInstallPlatform({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      }),
    ).toBe('ios');
    expect(
      detectInstallPlatform({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
        maxTouchPoints: 5,
      }),
    ).toBe('ios');
    expect(
      detectInstallPlatform({
        userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9)',
      }),
    ).toBe('android');
    expect(
      detectInstallPlatform({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      }),
    ).toBe('other');
  });

  it('limits the automatic offer to mobile devices', () => {
    expect(
      isLikelyMobileInstallDevice({
        userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9)',
      }),
    ).toBe(true);
    expect(
      isLikelyMobileInstallDevice({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      }),
    ).toBe(false);
  });

  it('detects the mobile browser independently from the operating system', () => {
    expect(
      detectInstallBrowser({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      }),
    ).toBe('safari');
    expect(
      detectInstallBrowser({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/126.0.0 Mobile/15E148 Safari/604.1',
      }),
    ).toBe('chrome');
    expect(
      detectInstallBrowser({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 EdgiOS/126.0 Mobile/15E148 Safari/605.1.15',
      }),
    ).toBe('edge');
    expect(
      detectInstallBrowser({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
      }),
    ).toBe('firefox');
    expect(
      detectInstallBrowser({
        userAgent:
          'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36 SamsungBrowser/26.0',
      }),
    ).toBe('samsung');
  });

  it('respects installed mode and the dismissal cooldown', () => {
    const now = Date.UTC(2026, 6, 15);
    expect(
      shouldAutoOfferInstall({ isMobile: true, installed: false, dismissedAt: null, now }),
    ).toBe(true);
    expect(
      shouldAutoOfferInstall({ isMobile: true, installed: true, dismissedAt: null, now }),
    ).toBe(false);
    expect(
      shouldAutoOfferInstall({ isMobile: false, installed: false, dismissedAt: null, now }),
    ).toBe(false);
    expect(
      shouldAutoOfferInstall({
        isMobile: true,
        installed: false,
        dismissedAt: now - INSTALL_OFFER_COOLDOWN_MS + 1,
        now,
      }),
    ).toBe(false);
    expect(
      shouldAutoOfferInstall({
        isMobile: true,
        installed: false,
        dismissedAt: now - INSTALL_OFFER_COOLDOWN_MS,
        now,
      }),
    ).toBe(true);
  });
});
