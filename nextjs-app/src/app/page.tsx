'use client'

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/login');
  }, [router]);

  return (
    <main className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-brand-blue mb-4">Psychočas</h1>
        <p className="text-brand-text/80">Přesměrovávání...</p>
      </div>
    </main>
  );
}
