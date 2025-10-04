'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';

interface TokenData {
  code: string;
  expiresAt: string;
}

export default function Redeem() {
  const [token, setToken] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const router = useRouter();

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
    <main className="min-h-screen bg-brand-gray">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-sm mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-brand-blue hover:text-brand-blue/80"
          >
            ← Zpět
          </button>
          <h1 className="text-lg font-avenir-black text-brand-blue">
            Uplatnit slevu
          </h1>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
        {/* Instructions */}
        <div className="bg-white rounded-card shadow-soft p-6">
          <h2 className="text-xl font-avenir-medium text-brand-text mb-3">
            Jak na to?
          </h2>
          <div className="space-y-2 text-sm text-brand-text/70 font-avenir">
            <p>1. Vygeneruj si kód pro slevu</p>
            <p>2. Ukaž QR kód nebo sdělte číselný kód</p>
            <p>3. Kód platí pouze 3 minuty!</p>
          </div>
        </div>

        {/* Token Generation */}
        {!token && (
          <div className="bg-white rounded-card shadow-soft p-6 text-center">
            <div className="text-4xl mb-4">🎫</div>
            <h3 className="text-lg font-avenir-medium text-brand-text mb-2">
              Vygenerovat kód
            </h3>
            <p className="text-sm text-brand-text/70 font-avenir mb-6">
              Stiskni tlačítko pro vytvoření nového kódu
            </p>
            
            <button
              onClick={generateToken}
              disabled={loading}
              className="w-full bg-brand-blue text-white py-4 px-4 rounded-button font-avenir-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-blue/90 transition-colors"
            >
              {loading ? 'Generuji...' : 'Vygenerovat kód'}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-brand-error/10 border border-brand-error/20 rounded-lg">
                <p className="text-sm text-brand-error font-avenir">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Active Token Display */}
        {token && (
          <div className="space-y-4">
            {/* Timer */}
            <div className="bg-white rounded-card shadow-soft p-4 text-center">
              <div className="text-2xl font-avenir-black text-brand-blue mb-2">
                {formatTime(timeLeft)}
              </div>
              <p className="text-sm text-brand-text/70 font-avenir">
                Zbývající čas
              </p>
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-brand-accent h-2 rounded-full transition-all duration-1000 ease-linear"
                  style={{
                    width: `${(timeLeft / (3 * 60 * 1000)) * 100}%`
                  }}
                />
              </div>
            </div>

            {/* QR Code */}
            <div className="bg-white rounded-card shadow-soft p-6 text-center">
              <h3 className="text-lg font-avenir-medium text-brand-text mb-4">
                QR Kód
              </h3>
              <div className="bg-white p-4 rounded-lg inline-block">
                <QRCode
                  value={token.code}
                  size={200}
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                />
              </div>
            </div>

            {/* Text Code */}
            <div className="bg-white rounded-card shadow-soft p-6">
              <h3 className="text-lg font-avenir-medium text-brand-text mb-4">
                Číselný kód
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-brand-gray p-4 rounded-lg text-center">
                  <span className="text-2xl font-avenir-black text-brand-blue letter-spacing-wide">
                    {token.code}
                  </span>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="bg-brand-accent text-white p-3 rounded-lg hover:bg-brand-accent/90 transition-colors"
                >
                  📋
                </button>
              </div>
            </div>

            {/* Generate New Button */}
            <button
              onClick={() => setToken(null)}
              className="w-full border border-brand-blue text-brand-blue py-3 px-4 rounded-button font-avenir-medium hover:bg-brand-blue/5 transition-colors"
            >
              Zrušit kód
            </button>
          </div>
        )}

        {/* Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-card p-4">
          <h4 className="font-avenir-medium text-amber-800 mb-2">
            ⚠️ Důležité
          </h4>
          <p className="text-sm text-amber-700 font-avenir">
            Kód můžete použít pouze jednou. Po uplatnění bude automaticky zneplatněn.
          </p>
        </div>
      </div>
    </main>
  );
}