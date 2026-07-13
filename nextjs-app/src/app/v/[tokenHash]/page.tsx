'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import useLocale from '@/hooks/useLocale';

export default function LegacyValidationRedirect() {
  const { tokenHash } = useParams<{ tokenHash: string }>();
  const { tr } = useLocale();

  useEffect(() => {
    if (tokenHash) window.location.replace(`/v#t=${encodeURIComponent(tokenHash)}`);
  }, [tokenHash]);

  return <main className="flex min-h-screen items-center justify-center text-sm">{tr('Přesměrovávám na bezpečné ověření…')}</main>;
}
