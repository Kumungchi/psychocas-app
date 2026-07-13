'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function LegacyValidationRedirect() {
  const { tokenHash } = useParams<{ tokenHash: string }>();

  useEffect(() => {
    if (tokenHash) window.location.replace(`/v#t=${encodeURIComponent(tokenHash)}`);
  }, [tokenHash]);

  return <main className="flex min-h-screen items-center justify-center text-sm">Přesměrovávám na bezpečné ověření…</main>;
}
