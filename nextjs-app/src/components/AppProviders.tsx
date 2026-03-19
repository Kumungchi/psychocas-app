'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/hooks/useAuth';
import { LocaleProvider } from '@/hooks/useLocale';
import LocaleToggle from '@/components/LocaleToggle';
import OfflineToast from '@/components/OfflineToast';
import { Toaster } from 'sonner';

interface AppProvidersProps {
  children: ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <LocaleProvider>
        <LocaleToggle />
        {children}
        <OfflineToast />
        <Toaster position="top-center" richColors />
      </LocaleProvider>
    </AuthProvider>
  );
}
