'use client'

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/login');
  }, [router]);

  return (
    <main className="psychocas-section flex items-center justify-center">
      <div className="text-center fade-in-up">
        <h1 className="mb-4">Psychočas</h1>
        <p style={{ color: '#666666' }}>Přesměrovávání...</p>
      </div>
    </main>
  );
}
