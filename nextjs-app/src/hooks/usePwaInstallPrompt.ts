import { useCallback, useEffect, useState } from 'react';
import { computeStandaloneMode } from '@/lib/pwa/displayMode';
import {
  detectInstallPlatform,
  isLikelyMobileInstallDevice,
  type InstallPlatform,
} from '@/lib/pwa/installOffer';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

interface InstallResult {
  outcome: 'accepted' | 'dismissed' | 'unavailable';
}

export default function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('other');
  const [isMobile, setIsMobile] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const device = {
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
    };

    const syncEnvironment = () => {
      setInstalled(
        computeStandaloneMode({
          matchMediaStandalone: standaloneQuery.matches,
          navigatorStandalone: navigatorWithStandalone.standalone,
        }),
      );
      setPlatform(detectInstallPlatform(device));
      setIsMobile(isLikelyMobileInstallDevice(device));
      setReady(true);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    const animationFrame = window.requestAnimationFrame(syncEnvironment);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    standaloneQuery.addEventListener?.('change', syncEnvironment);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      standaloneQuery.removeEventListener?.('change', syncEnvironment);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallResult> => {
    if (!deferredPrompt) {
      return { outcome: 'unavailable' };
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      setDeferredPrompt(null);

      if (choice?.outcome === 'accepted') {
        setInstalled(true);
        return { outcome: 'accepted' };
      }

      return { outcome: 'dismissed' };
    } catch (error) {
      console.error('Failed to show PWA install prompt:', error);
      setDeferredPrompt(null);
      return { outcome: 'dismissed' };
    }
  }, [deferredPrompt]);

  return {
    canInstall: !!deferredPrompt,
    installed,
    isMobile,
    platform,
    ready,
    promptInstall,
  };
}
