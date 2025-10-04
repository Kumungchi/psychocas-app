'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export default function Validate() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const validateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/redeem_token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: code.trim().toUpperCase() }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nepodařilo se validovat kód');
      }

      const data = await response.json();
      setResult(data);
      setCode(''); // Clear input on success

    } catch (error) {
      console.error('Error validating code:', error);
      setError(error instanceof Error ? error.message : 'Nastala neočekávaná chyba');
    } finally {
      setLoading(false);
    }
  };

  const getResultMessage = (result: ValidationResult) => {
    if (result.valid) {
      return {
        title: 'Kód platný! ✅',
        message: 'Sleva byla úspěšně uplatněna',
        color: 'success'
      };
    }

    switch (result.reason) {
      case 'used_or_not_found':
        return {
          title: 'Kód neplatný ❌',
          message: 'Kód již byl použit nebo neexistuje',
          color: 'error'
        };
      case 'expired':
        return {
          title: 'Kód expiroval ⏰',
          message: 'Kód již vypršel (platnost 3 minuty)',
          color: 'error'
        };
      case 'inactive_membership':
        return {
          title: 'Neaktivní členství ❌',
          message: 'Vlastník kódu nemá aktivní členství',
          color: 'error'
        };
      default:
        return {
          title: 'Kód neplatný ❌',
          message: 'Neznámý důvod neplatnosti',
          color: 'error'
        };
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
            Validace kódu
          </h1>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
        {/* Instructions */}
        <div className="bg-white rounded-card shadow-soft p-6">
          <h2 className="text-xl font-avenir-medium text-brand-text mb-3">
            Jak validovat?
          </h2>
          <div className="space-y-2 text-sm text-brand-text/70 font-avenir">
            <p>1. Zadejte nebo naskenujte kód od zákazníka</p>
            <p>2. Stiskněte tlačítko "Validovat"</p>
            <p>3. Sledujte výsledek validace</p>
            <p>4. Každý kód lze použít pouze jednou</p>
          </div>
        </div>

        {/* Validation Form */}
        <div className="bg-white rounded-card shadow-soft p-6">
          <h3 className="text-lg font-avenir-medium text-brand-text mb-4">
            Zadat kód
          </h3>
          
          <form onSubmit={validateCode} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-avenir-medium text-brand-text mb-2">
                Slevový kód
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC4-XY89"
                className="w-full px-4 py-3 border border-gray-200 rounded-button focus:ring-2 focus:ring-brand-accent focus:border-transparent font-avenir text-center text-lg tracking-wider"
                disabled={loading}
                maxLength={9}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full bg-brand-blue text-white py-4 px-4 rounded-button font-avenir-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-blue/90 transition-colors"
            >
              {loading ? 'Validuji...' : 'Validovat kód'}
            </button>
          </form>
        </div>

        {/* Validation Result */}
        {result && (
          <div className={`rounded-card shadow-soft p-6 ${
            result.valid 
              ? 'bg-brand-success/10 border border-brand-success/20' 
              : 'bg-brand-error/10 border border-brand-error/20'
          }`}>
            {(() => {
              const message = getResultMessage(result);
              return (
                <div className="text-center">
                  <div className="text-4xl mb-3">
                    {result.valid ? '✅' : '❌'}
                  </div>
                  <h3 className={`text-lg font-avenir-medium mb-2 ${
                    result.valid ? 'text-brand-success' : 'text-brand-error'
                  }`}>
                    {message.title}
                  </h3>
                  <p className={`text-sm font-avenir ${
                    result.valid ? 'text-brand-success/80' : 'text-brand-error/80'
                  }`}>
                    {message.message}
                  </p>
                </div>
              );
            })()}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-brand-error/10 border border-brand-error/20 rounded-card p-4">
            <h4 className="font-avenir-medium text-brand-error mb-2">
              Chyba při validaci
            </h4>
            <p className="text-sm text-brand-error/80 font-avenir">{error}</p>
          </div>
        )}

        {/* QR Scanner Placeholder */}
        <div className="bg-white rounded-card shadow-soft p-6 text-center">
          <div className="text-4xl mb-3">📷</div>
          <h3 className="text-lg font-avenir-medium text-brand-text mb-2">
            QR Scanner
          </h3>
          <p className="text-sm text-brand-text/70 font-avenir mb-4">
            Funkcionalita skenování QR kódů bude přidána později
          </p>
          <button
            disabled
            className="px-4 py-2 bg-gray-200 text-gray-500 rounded-button font-avenir-medium cursor-not-allowed"
          >
            Skenovat QR kód
          </button>
        </div>

        {/* Statistics Link */}
        <div className="text-center">
          <button
            onClick={() => router.push('/stats')}
            className="text-brand-blue hover:text-brand-blue/80 font-avenir text-sm"
          >
            📊 Zobrazit statistiky →
          </button>
        </div>
      </div>
    </main>
  );
}