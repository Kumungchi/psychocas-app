'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { colors, radii, shadows } from '@/ui/theme';
import useLocale from '@/hooks/useLocale';

export default function ServiceWorkerManager() {
  const { tr } = useLocale();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') {
      return;
    }

    const onControllerChange = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    let updateTimer: number | undefined;

    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(installing);
            }
          });
        });

        updateTimer = window.setInterval(() => void registration.update(), 60 * 60 * 1000);
      })
      .catch((error) => {
        console.warn('Service worker registration failed', error);
      });

    return () => {
      if (updateTimer !== undefined) window.clearInterval(updateTimer);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!waitingWorker) return null;

  return (
    <aside
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-[70] mx-auto flex max-w-md items-center gap-3 border px-4 py-3"
      role="status"
      style={{
        borderColor: colors.border,
        borderRadius: radii.md,
        background: colors.background,
        color: colors.textPrimary,
        boxShadow: shadows.md,
      }}
    >
      <RefreshCw className="h-5 w-5 shrink-0" style={{ color: colors.brandPrimary }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{tr('Je dostupná nová verze')}</p>
        <p className="text-xs" style={{ color: colors.textSecondary }}>
          {tr('Aktualizace zachová přihlášení a načte nejnovější funkce.')}
        </p>
      </div>
      <button
        type="button"
        className="min-h-10 px-3 text-sm font-semibold text-white"
        style={{ borderRadius: radii.sm, background: colors.brandPrimary }}
        onClick={() => waitingWorker.postMessage({ type: 'SKIP_WAITING' })}
      >
        {tr('Aktualizovat')}
      </button>
      <button
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center"
        aria-label={tr('Skrýt upozornění')}
        title={tr('Skrýt')}
        onClick={() => setWaitingWorker(null)}
      >
        <X className="h-4 w-4" />
      </button>
    </aside>
  );
}
