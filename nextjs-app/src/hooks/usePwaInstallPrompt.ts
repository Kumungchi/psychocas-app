import { useCallback, useEffect, useState } from 'react';

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

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
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
    promptInstall,
  };
}
