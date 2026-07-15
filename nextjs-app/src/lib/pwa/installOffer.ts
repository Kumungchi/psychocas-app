export type InstallPlatform = 'ios' | 'android' | 'other';
export type InstallBrowser = 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'other';

export const INSTALL_OFFER_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

interface DeviceDetectionInput {
  userAgent: string;
  maxTouchPoints?: number;
}

export function detectInstallPlatform({
  userAgent,
  maxTouchPoints = 0,
}: DeviceDetectionInput): InstallPlatform {
  if (/android/i.test(userAgent)) return 'android';
  if (/iPad|iPhone|iPod/i.test(userAgent)) return 'ios';
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
  return 'other';
}

export function detectInstallBrowser({ userAgent }: DeviceDetectionInput): InstallBrowser {
  if (/SamsungBrowser/i.test(userAgent)) return 'samsung';
  if (/EdgiOS|EdgA|Edg\//i.test(userAgent)) return 'edge';
  if (/FxiOS|Firefox\//i.test(userAgent)) return 'firefox';
  if (/CriOS|Chrome\//i.test(userAgent)) return 'chrome';
  if (/Safari\//i.test(userAgent) && /Version\//i.test(userAgent)) return 'safari';
  return 'other';
}

export function isLikelyMobileInstallDevice(input: DeviceDetectionInput): boolean {
  return (
    detectInstallPlatform(input) !== 'other' ||
    /Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(input.userAgent)
  );
}

interface AutoOfferInput {
  isMobile: boolean;
  installed: boolean;
  dismissedAt: number | null;
  now?: number;
}

export function shouldAutoOfferInstall({
  isMobile,
  installed,
  dismissedAt,
  now = Date.now(),
}: AutoOfferInput): boolean {
  if (!isMobile || installed) return false;
  if (dismissedAt === null || !Number.isFinite(dismissedAt)) return true;
  return now - dismissedAt >= INSTALL_OFFER_COOLDOWN_MS;
}
