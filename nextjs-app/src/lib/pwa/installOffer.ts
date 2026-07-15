export type InstallPlatform = 'ios' | 'android' | 'other';

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
