'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineToast() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const updateStatus = () => {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setIsOnline(online);
      setVisible(true);
      if (online) {
        const timeout = window.setTimeout(() => setVisible(false), 2500);
        return () => window.clearTimeout(timeout);
      }
      return undefined;
    };

    const handleOnline = () => {
      updateStatus();
    };

    const handleOffline = () => {
      updateStatus();
    };

    updateStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!visible) {
    return null;
  }

  const isOffline = !isOnline;
  const backgroundColor = isOffline ? '#b91c1c' : '#047857';
  const Icon = isOffline ? WifiOff : Wifi;
  const message = isOffline
    ? 'Jste offline. Zobrazuje se poslední dostupná verze.'
    : 'Připojení obnoveno. Údaje jsou opět aktuální.';

  return (
    <div
      className="fixed left-1/2 bottom-24 z-50 -translate-x-1/2 px-4"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-lg"
        style={{ backgroundColor, pointerEvents: 'auto' }}
      >
        <Icon className="h-5 w-5" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
