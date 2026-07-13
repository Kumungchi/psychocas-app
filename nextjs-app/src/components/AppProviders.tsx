'use client';

import type { ReactNode } from 'react';
import { LocaleProvider } from '@/hooks/useLocale';
import OfflineToast from '@/components/OfflineToast';
import ServiceWorkerManager from '@/components/ServiceWorkerManager';
import { Toaster } from 'sonner';

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      {children}
      <OfflineToast />
      <ServiceWorkerManager />
      <Toaster position="top-center" richColors />
    </LocaleProvider>
  );
}
