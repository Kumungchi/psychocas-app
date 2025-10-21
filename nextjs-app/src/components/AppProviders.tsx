'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/hooks/useAuth';
import { LocaleProvider } from '@/hooks/useLocale';
import LocaleToggle from '@/components/LocaleToggle';
import OfflineToast from '@/components/OfflineToast';

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
      </LocaleProvider>
    </AuthProvider>
  );
}
