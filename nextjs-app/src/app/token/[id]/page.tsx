'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { supabase } from '@/lib/supabaseClient';
import useLocale from '@/hooks/useLocale';
import { getTokenCountdown, formatCountdown, type TokenCountdown } from '@/lib/tokens';
import { Copy, RefreshCw, ArrowLeft, AlertCircle, Timer } from 'lucide-react';
import { toast } from 'sonner';

export default function TokenPage() {
  const { id: discountId } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLocale();

  const [code, setCode] = useState<string | null>(null);
  const [validationUrl, setValidationUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<TokenCountdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const generateToken = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke('generate_token', {
      body: { discount_id: discountId },
    });

    if (fnError || data?.error) {
      const errMsg = data?.error || fnError?.message || 'unknown_error';
      if (errMsg === 'active_token_exists') setError(t('tokenPage.errActive'));
      else if (errMsg === 'membership_inactive') setError(t('tokenPage.errMembership'));
      else if (errMsg === 'discount_not_found') setError(t('tokenPage.errNotFound'));
      else setError(t('tokenPage.errGeneric'));
      setLoading(false);
      return;
    }

    setCode(data.code);
    setExpiresAt(data.expires_at);
    setValidationUrl(data.validation_url);
    setLoading(false);
  }, [discountId, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- generate token on mount
    void generateToken();
  }, [generateToken]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setCountdown(getTokenCountdown(expiresAt));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isExpired = countdown?.isExpired ?? false;
  const isWarning = !isExpired && countdown?.minutes === 0 && (countdown?.seconds ?? 60) <= 30;

  const timerColor = isExpired
    ? '#dc2626'
    : isWarning ? '#f57c00'
    : '#16a34a';

  const copyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      toast.success(t('tokenPage.copied'));
    }
  };

  const regenerate = () => {
    setCode(null);
    setExpiresAt(null);
    setCountdown(null);
    void generateToken();
  };

  return (
    <main style={{ minHeight: '100dvh', backgroundColor: '#f5f5f5' }}>
      <div style={{ maxWidth: '28rem', margin: '0 auto', padding: 'clamp(1rem, 4vw, 1.5rem)' }} className="space-y-5 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/discounts')}
            style={{
              background: '#fff', border: '1px solid #e0e0e0', borderRadius: '50%',
              width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#1d4f7d', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 style={{ color: '#1d4f7d', margin: 0 }}>{t('tokenPage.title')}</h1>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-sm text-center py-12">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#1d4f7d' }} />
            <p className="mt-4 text-gray-500">{t('tokenPage.generating')}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-white rounded-2xl shadow-sm text-center py-10 space-y-4">
            <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
            <p className="text-red-500">{error}</p>
            <button
              onClick={() => router.push('/discounts')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-white"
              style={{ backgroundColor: '#1d4f7d', maxWidth: '16rem', margin: '0 auto' }}
            >
              {t('tokenPage.backToDiscounts')}
            </button>
          </div>
        )}

        {/* Token display */}
        {!loading && !error && code && validationUrl && (
          <>
            <div className="bg-white rounded-2xl shadow-sm text-center space-y-5 p-6">
              <p className="text-gray-500" style={{ fontSize: '0.9rem' }}>{t('tokenPage.showAtCheckout')}</p>

              {/* QR */}
              <div
                className="flex items-center justify-center mx-auto rounded-2xl border-2 transition-all duration-500"
                style={{
                  borderColor: isExpired ? '#e0e0e0' : '#e3f2fd',
                  backgroundColor: isExpired ? '#f8f8f8' : '#f0f7ff',
                  padding: 'clamp(1rem, 4vw, 1.5rem)',
                  opacity: isExpired ? 0.45 : 1,
                  width: 'fit-content',
                }}
              >
                <QRCode
                  value={validationUrl}
                  size={Math.min(200, typeof window !== 'undefined' ? window.innerWidth - 140 : 200)}
                  bgColor="transparent"
                  fgColor={isExpired ? '#999999' : '#1d4f7d'}
                />
              </div>

              {/* Short code */}
              <div
                className="font-mono tracking-[0.18em] text-xl font-semibold py-3 px-6 rounded-2xl inline-block transition-all duration-500"
                style={{
                  backgroundColor: isExpired ? '#f8f8f8' : '#e8f4fd',
                  color: isExpired ? '#999999' : '#1d4f7d',
                  letterSpacing: '0.2em',
                }}
              >
                {code}
              </div>

              {/* Countdown */}
              <div>
                <div className="flex items-center justify-center gap-2 mb-2 text-gray-400">
                  <Timer className="w-4 h-4" />
                  <span style={{ fontSize: '0.85rem' }}>{t('tokenPage.timeLeft')}</span>
                </div>
                <div className="text-4xl font-mono font-bold mb-3" style={{ color: timerColor }}>
                  {countdown ? formatCountdown(countdown) : '--:--'}
                </div>

                {countdown && !isExpired && (
                  <div className="w-full h-[6px] rounded-full overflow-hidden bg-gray-200">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${countdown.percentLeft}%`, backgroundColor: timerColor }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Action button */}
            {!isExpired ? (
              <button
                onClick={copyCode}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-white"
                style={{ backgroundColor: '#1d4f7d' }}
              >
                <Copy className="w-5 h-5" />
                {t('tokenPage.copyCode')}
              </button>
            ) : (
              <button
                onClick={regenerate}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-white"
                style={{ backgroundColor: '#1d4f7d' }}
              >
                <RefreshCw className="w-5 h-5" />
                {t('tokenPage.generateNew')}
              </button>
            )}

            {/* How to use */}
            <div className="bg-white rounded-2xl shadow-sm space-y-3 p-5">
              <h3 className="text-gray-700 mb-3 font-semibold">{t('tokenPage.howToUse')}</h3>
              {[t('tokenPage.step1'), t('tokenPage.step2'), t('tokenPage.step3')].map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className="mt-[6px] flex-shrink-0 rounded-full inline-block"
                    style={{ width: 7, height: 7, backgroundColor: '#049edb' }}
                  />
                  <span className="text-gray-500" style={{ fontSize: '0.9rem' }}>{text}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
