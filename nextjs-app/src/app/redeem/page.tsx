'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import Navigation from '@/components/Navigation';
import type { TokenData } from '@/types/member';

export default function Redeem() {
  const [token, setToken] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [userRole, setUserRole] = useState<'member' | 'manager' | 'council' | 'technician'>('member');
  const router = useRouter();

  // Fetch user role on mount
  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: member } = await supabase
          .from('members')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (member) {
          setUserRole(member.role as 'member' | 'manager' | 'council' | 'technician');
        }
      }
    };

    fetchUserRole();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const expiry = new Date(token.expiresAt).getTime();
      const remaining = Math.max(0, expiry - now);

      setTimeLeft(remaining);

      if (remaining === 0) {
        setToken(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [token]);

  const generateToken = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate_token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nepodařilo se vygenerovat kód');
      }

      const data = await response.json();
      setToken({
        code: data.code,
        expiresAt: data.expiresAt
      });

    } catch (error) {
      console.error('Error generating token:', error);
      setError(error instanceof Error ? error.message : 'Nastala neočekávaná chyba');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = async () => {
    if (token) {
      try {
        await navigator.clipboard.writeText(token.code);
        // Could add toast notification here
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    }
  };

  return (
    <main className="psychocas-section">
      <div className="psychocas-container space-y-8 fade-in-up">
        {/* Header */}
        <div className="flex items-center gap-4 pt-6">
          <button
            onClick={() => router.back()}
            className="p-3 hover:bg-white/50 rounded-full transition-all duration-300"
            style={{ color: '#1d4f7d' }}
          >
            ←
          </button>
          <h1>
            Slevový kód
          </h1>
        </div>

        {/* Instructions */}
        <div className="psychocas-card">
          <h3 className="mb-4" style={{ color: '#333333' }}>
            Jak použít kód
          </h3>
          <div className="space-y-3" style={{ color: '#666666' }}>
            <div className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0"></span>
              <span>Ukažte kód nebo QR kód u pokladny</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0"></span>
              <span>Kód je platný 3 minuty od vygenerování</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0"></span>
              <span>Po vypršení času můžete vygenerovat nový kód</span>
            </div>
          </div>
        </div>

        {/* Token Generation */}
        {!token && (
          <div className="psychocas-card text-center">
            <div className="text-4xl mb-4">🎫</div>
            <h2 className="mb-3" style={{ color: '#333333' }}>
              Vygenerovat kód
            </h2>
            <p className="mb-6" style={{ color: '#666666' }}>
              Stiskni tlačítko pro vytvoření nového kódu
            </p>
            
            <button
              onClick={generateToken}
              disabled={loading}
              className="psychocas-button-primary"
            >
              {loading ? 'Generuji...' : 'Vygenerovat kód'}
            </button>

            {error && (
              <div className="mt-6 p-4 rounded-xl status-inactive">
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Active Token Display */}
        {token && (
          <div className="psychocas-card">
            <div className="space-y-8">
              {/* Code Display */}
              <div className="text-center space-y-6">
                <h2 style={{ color: '#333333', marginBottom: '2rem' }}>Váš slevový kód</h2>
                
                <div 
                  className="p-6 rounded-2xl border-2 transition-all duration-300"
                  style={{
                    backgroundColor: timeLeft <= 0 ? '#f5f5f5' : '#e1f5fe',
                    borderColor: timeLeft <= 0 ? '#cccccc' : '#81d4fa'
                  }}
                >
                  <div 
                    className="text-3xl font-mono tracking-wider"
                    style={{ 
                      color: timeLeft <= 0 ? '#999999' : '#1d4f7d',
                      fontFamily: 'SF Mono, Monaco, monospace',
                      fontWeight: '600'
                    }}
                  >
                    {token.code}
                  </div>
                </div>

                {/* Copy Button */}
                <button
                  onClick={copyToClipboard}
                  disabled={timeLeft <= 0}
                  className="flex items-center gap-3 px-6 py-3 mx-auto transition-all duration-300"
                  style={{ 
                    backgroundColor: timeLeft <= 0 ? '#cccccc' : '#049edb',
                    color: '#ffffff',
                    borderRadius: '1.5rem',
                    height: '3.5rem',
                    border: 'none',
                    cursor: timeLeft <= 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  📋 Kopírovat kód
                </button>
              </div>

              {/* QR Code Section */}
              <div className="text-center space-y-6 pt-6 border-t" style={{ borderColor: '#e0e0e0' }}>
                <div className="inline-block p-4 bg-white rounded-2xl">
                  <QRCode
                    value={token.code}
                    size={200}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  />
                </div>
                <p style={{ color: '#666666' }}>
                  QR kód pro rychlé uplatnění
                </p>
              </div>

              {/* Timer */}
              <div className="text-center space-y-3">
                <p style={{ color: '#666666' }}>
                  Zbývající čas
                </p>
                <div 
                  className="text-3xl font-mono font-bold"
                  style={{
                    color: timeLeft <= 0 ? '#c62828' : timeLeft <= 30000 ? '#f57c00' : '#2e7d32'
                  }}
                >
                  {timeLeft <= 0 ? 'VYPRŠEL' : formatTime(timeLeft)}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-1000 ease-linear"
                    style={{
                      width: `${(timeLeft / (3 * 60 * 1000)) * 100}%`,
                      backgroundColor: timeLeft <= 30000 ? '#f57c00' : '#2e7d32'
                    }}
                  />
                </div>
              </div>

              {/* Regenerate Button */}
              {timeLeft <= 0 && (
                <button
                  onClick={generateToken}
                  className="psychocas-button-primary flex items-center gap-3 justify-center"
                >
                  🔄 Vygenerovat nový kód
                </button>
              )}

              {/* Cancel Button */}
              {timeLeft > 0 && (
                <button
                  onClick={() => setToken(null)}
                  className="psychocas-button-secondary"
                >
                  Zrušit kód
                </button>
              )}
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="psychocas-card" style={{ backgroundColor: '#fff8e1', border: '1px solid #ffe082' }}>
          <h4 className="mb-2" style={{ color: '#f57c00' }}>
            ⚠️ Důležité
          </h4>
          <p className="text-sm" style={{ color: '#f57c00' }}>
            Kód můžete použít pouze jednou. Po uplatnění bude automaticky zneplatněn.
          </p>
        </div>
      </div>

      {/* Navigation Bar */}
      <Navigation userRole={userRole} />
    </main>
  );
}