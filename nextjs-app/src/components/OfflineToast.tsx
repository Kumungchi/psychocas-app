'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { usePathname } from 'next/navigation';
import useNetworkStatus from '@/hooks/useNetworkStatus';
import useLocale from '@/hooks/useLocale';

export default function OfflineToast() {
  const isOnline = useNetworkStatus();
  const [visible, setVisible] = useState<boolean>(false);
  const { t } = useLocale();
  const pathname = usePathname();
  const quietRoute = pathname === '/' || pathname === '/login' || pathname.startsWith('/demo') || pathname.startsWith('/auth');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (quietRoute) return;

    setVisible(true); // eslint-disable-line react-hooks/set-state-in-effect -- sync toast visibility from network status

    if (isOnline) {
      const timeout = window.setTimeout(() => setVisible(false), 2500);
      return () => window.clearTimeout(timeout);
    }

    return () => {
      // keep toast visible while offline
    };
  }, [isOnline, quietRoute]);

  if (quietRoute || !visible) {
    return null;
  }

  const isOffline = !isOnline;
  const backgroundColor = isOffline ? '#b91c1c' : '#047857';
  const Icon = isOffline ? WifiOff : Wifi;
  const message = isOffline ? t('offlineToast.offline') : t('offlineToast.online');

  return (
    <div
      className="fixed left-1/2 bottom-24 z-50 -translate-x-1/2 px-4"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="flex items-center gap-3 rounded-lg px-4 py-3 text-white shadow-lg"
        style={{ backgroundColor, pointerEvents: 'auto' }}
      >
        <Icon className="h-5 w-5" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
