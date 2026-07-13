'use client';

import type { ReactNode } from 'react';
import { LocaleProvider } from '@/hooks/useLocale';
import OfflineToast from '@/components/OfflineToast';
import LocaleToggle from '@/components/LocaleToggle';
import ServiceWorkerManager from '@/components/ServiceWorkerManager';
import { Toaster } from 'sonner';

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <LocaleToggle />
      {children}
      <OfflineToast />
      <ServiceWorkerManager />
      <Toaster position="top-center" richColors />
    </LocaleProvider>
  );
}
