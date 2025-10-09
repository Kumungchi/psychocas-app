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
        <div className="mb-8 flex justify-center">
          <svg width="100" height="100" viewBox="-60 -60 120 120" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="rootLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#1d4f7d', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#049edb', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <circle cx="0" cy="0" r="55" fill="url(#rootLogoGradient)" />
            <circle cx="0" cy="0" r="50" fill="none" stroke="white" strokeWidth={6}/>
            <line x1="0" y1="0" x2="-15" y2="-25" stroke="white" strokeWidth={5} strokeLinecap="round"/>
            <line x1="0" y1="0" x2="25" y2="-15" stroke="white" strokeWidth={4} strokeLinecap="round"/>
            <circle cx="0" cy="0" r="6" fill="white"/>
            <circle cx="0" cy="-40" r="4" fill="white"/>
            <circle cx="40" cy="0" r="4" fill="white"/>
            <circle cx="0" cy="40" r="4" fill="white"/>
            <circle cx="-40" cy="0" r="4" fill="white"/>
          </svg>
        </div>
        <h1 className="mb-4">Psychočas</h1>
        <p style={{ color: '#666666' }}>Přesměrovávání...</p>
      </div>
    </main>
  );
}
