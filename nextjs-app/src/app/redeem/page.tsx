'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { supabase } from '@/lib/supabaseClient';
import Navigation from '@/components/Navigation';
import useLocale from '@/hooks/useLocale';
import useMemberContext from '@/hooks/useMemberContext';
import type { TokenData } from '@/types/member';
import { colors, radii } from '@/ui/theme';

const MAX_TOKEN_DURATION_MS = 3 * 60 * 1000;

export default function Redeem() {
  const { t, formatMessage } = useLocale();
  const router = useRouter();
  const { status, member, error: memberError, refresh } = useMemberContext({ scope: 'redeem-page' });
  const memberRole = member?.role ?? 'member';
  const isDemo = member?.origin === 'demo';

  const [token, setToken] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!token) {
      setTimeLeft(0);
      return;
    }

    const interval = window.setInterval(() => {
      const expiry = new Date(token.expiresAt).getTime();
      const remaining = Math.max(0, expiry - Date.now());
      setTimeLeft(remaining);

      if (remaining === 0) {
        setToken(null);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [token]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleGenerate = async () => {
    if (isDemo) {
      setError(t('redeem.demo.disabledAction'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate_token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || t('redeem.messages.generateError'));
      }

      const data = await response.json();
      setToken({ code: data.code, expiresAt: data.expiresAt });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('redeem.messages.generateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!token) {
      return;
    }

    try {
      await navigator.clipboard.writeText(token.code);
    } catch (copyError) {
      setError(t('redeem.messages.clipboardError'));
      console.error('Failed to copy code', copyError);
    }
  };

  const instructions = useMemo(
    () => [
      t('redeem.instructions.steps.present'),
      t('redeem.instructions.steps.lifetime'),
      t('redeem.instructions.steps.regenerate'),
    ],
    [t]
  );

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card" style={{ color: colors.textSecondary }}>
            {t('redeem.states.loadingMember')}
          </div>
        </div>
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card space-y-3">
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {t('redeem.states.loginTitle')}
            </h2>
            <p style={{ color: colors.textSecondary }}>{t('redeem.states.loginDescription')}</p>
          </div>
        </div>
      </main>
    );
  }

  if (status === 'error' || !member) {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card space-y-3">
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {t('redeem.states.errorTitle')}
            </h2>
            <p style={{ color: colors.textSecondary }}>{memberError ?? t('redeem.states.errorDescription')}</p>
            <button onClick={refresh} className="psychocas-button-primary w-max">
              {t('redeem.states.refreshButton')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="psychocas-section pb-20">
      <div className="psychocas-container space-y-8 fade-in-up">
        <div className="flex items-center gap-4 pt-6">
          <button
            onClick={() => router.back()}
            className="p-3 rounded-full transition-all"
            style={{
              color: colors.brandPrimary,
              border: `1px solid ${colors.brandPrimary}`,
              backgroundColor: colors.background,
            }}
          >
            {t('redeem.back')}
          </button>
          <h1>{t('redeem.heading')}</h1>
        </div>

        <section className="psychocas-card space-y-3">
          <h3 style={{ color: colors.textPrimary }}>{t('redeem.instructions.heading')}</h3>
          <ul className="space-y-2" style={{ color: colors.textSecondary }}>
            {instructions.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: colors.brandPrimary }}
                />
                <span>{`${index + 1}. ${step}`}</span>
              </li>
            ))}
          </ul>
        </section>

        {!token && (
          <section className="psychocas-card text-center space-y-4">
            <div className="text-4xl" aria-hidden>
              🎫
            </div>
            <h2 style={{ color: colors.textPrimary }}>{t('redeem.idle.heading')}</h2>
            <p style={{ color: colors.textSecondary }}>{t('redeem.idle.description')}</p>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="psychocas-button-primary"
            >
              {loading ? t('redeem.idle.loading') : t('redeem.idle.action')}
            </button>
            {isDemo && (
              <p className="text-sm" style={{ color: colors.warning }}>
                {t('redeem.demo.notice')}
              </p>
            )}
            {error && (
              <div
                className="mx-auto max-w-md rounded-xl px-4 py-3"
                style={{
                  border: `1px solid ${colors.danger}`,
                  color: colors.danger,
                  backgroundColor: colors.dangerSurface,
                }}
              >
                {error}
              </div>
            )}
          </section>
        )}

        {token && (
          <section className="psychocas-card space-y-8">
            <div className="text-center space-y-4">
              <h2 style={{ color: colors.textPrimary }}>{t('redeem.active.heading')}</h2>
              <div
                className="mx-auto w-full max-w-sm border-2 p-6"
                style={{
                  borderRadius: radii.lg,
                  borderColor: timeLeft <= 0 ? colors.border : colors.brandPrimary,
                  backgroundColor: timeLeft <= 0 ? colors.backgroundMuted : colors.brandSurface,
                }}
              >
                <p
                  className="text-3xl font-mono font-semibold tracking-widest"
                  style={{ color: timeLeft <= 0 ? colors.textSecondary : colors.brandPrimary }}
                >
                  {token.code}
                </p>
              </div>
              <button
                onClick={handleCopy}
                disabled={timeLeft <= 0}
                className="mx-auto flex items-center gap-2 px-6 py-3"
                style={{
                  borderRadius: radii.full,
                  backgroundColor: timeLeft <= 0 ? colors.border : colors.brandPrimary,
                  color: colors.background,
                  opacity: timeLeft <= 0 ? 0.5 : 1,
                }}
              >
                📋 {t('redeem.active.copyButton')}
              </button>
            </div>

            <div className="space-y-4 border-t pt-6" style={{ borderColor: colors.border }}>
              <div className="inline-block rounded-2xl bg-white p-4">
                <QRCode value={formatMessage('redeem.qr.value', { code: token.code })} size={200} />
              </div>
              <p className="text-center text-sm" style={{ color: colors.textSecondary }}>
                {formatMessage('redeem.qr.description', { code: token.code })}
              </p>
            </div>

            <div className="space-y-2 text-center">
              <p style={{ color: colors.textSecondary }}>{t('redeem.active.timerLabel')}</p>
              <p
                className="text-3xl font-mono font-semibold"
                style={{
                  color:
                    timeLeft <= 0
                      ? colors.danger
                      : timeLeft <= 30000
                        ? colors.warning
                        : colors.accent,
                }}
              >
                {timeLeft <= 0 ? t('redeem.active.expiredLabel') : formatTime(timeLeft)}
              </p>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(timeLeft / MAX_TOKEN_DURATION_MS) * 100}%`,
                    backgroundColor: timeLeft <= 30000 ? colors.warning : colors.brandPrimary,
                  }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {timeLeft <= 0 ? (
                <button onClick={handleGenerate} className="psychocas-button-primary">
                  {t('redeem.active.regenerate')}
                </button>
              ) : (
                <button onClick={() => setToken(null)} className="psychocas-button-secondary">
                  {t('redeem.active.cancel')}
                </button>
              )}
              {error && (
                <span className="text-sm" style={{ color: colors.danger }}>
                  {error}
                </span>
              )}
            </div>
          </section>
        )}

        <section
          className="psychocas-card space-y-2"
          style={{
            border: `1px solid ${colors.warning}`,
            backgroundColor: colors.warningSurfaceAlt,
          }}
        >
          <h4 style={{ color: colors.warning }}>{t('redeem.warning.title')}</h4>
          <p className="text-sm" style={{ color: colors.warning }}>
            {t('redeem.warning.description')}
          </p>
        </section>
      </div>

      <Navigation userRole={memberRole} />
    </main>
  );
}