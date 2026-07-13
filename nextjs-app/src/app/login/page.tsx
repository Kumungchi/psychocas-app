'use client';

import { Suspense } from 'react';
import ConvexLoginPanel from '@/components/ConvexLoginPanel';
import PsychocasLogo from '@/components/PsychocasLogo';
import { colors } from '@/ui/theme';

function LoginLoading() {
  return (
    <main
      className="flex min-h-screen items-center justify-center"
      style={{ background: colors.backgroundMuted }}
    >
      <div className="flex flex-col items-center gap-3" role="status">
        <PsychocasLogo size={48} gradientId="loginLoadingLogo" />
        <span className="text-sm" style={{ color: colors.textSecondary }}>Načítám přihlášení…</span>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <ConvexLoginPanel />
    </Suspense>
  );
}
