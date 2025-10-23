'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { supabase } from '@/lib/supabaseClient';
import { logError } from '@/lib/logging';
import { useRouter, useSearchParams } from 'next/navigation';
import useLocale from '@/hooks/useLocale';
import { sanitizeRedirect } from '@/lib/navigation/redirect';
import { computeStandaloneMode } from '@/lib/pwa/displayMode';
import { MailCheck, Sparkles, WifiOff } from 'lucide-react';

type MessageState = {
  type: 'success' | 'error' | 'info';
  translationKey?: string;
  text?: string;
  params?: Record<string, string | number>;
};

type StandaloneCapableNavigator = Navigator & { standalone?: boolean };

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, formatMessage } = useLocale();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  const requestedRedirect = searchParams.get('redirectTo');
  const sanitizedRedirect = useMemo(
    () => sanitizeRedirect(requestedRedirect),
    [requestedRedirect]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const resolveDisplayMode = () => {
      const navigatorStandalone =
        typeof window.navigator === 'object'
          ? (window.navigator as StandaloneCapableNavigator).standalone
          : undefined;

      const displayModes = ['standalone', 'window-controls-overlay', 'minimal-ui', 'fullscreen'] as const;
      const activeDisplayMode = displayModes.find((mode) => window.matchMedia(`(display-mode: ${mode})`).matches) ?? null;

      setIsStandalone(
        computeStandaloneMode({
          displayMode: activeDisplayMode,
          matchMediaStandalone: activeDisplayMode != null,
          navigatorStandalone,
        })
      );
    };

    resolveDisplayMode();
    const handleVisibility = () => resolveDisplayMode();
    const handleAppInstalled = () => resolveDisplayMode();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Surface any error returned by the callback handler so users understand why they landed here
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');

    if (!errorParam && !messageParam) {
      return;
    }

    if (errorParam === 'unauthorized') {
      setMessage({ type: 'error', translationKey: 'login.messages.errorUnauthorized' });
    } else if (messageParam) {
      setMessage({ type: 'error', text: messageParam });
    } else {
      setMessage({ type: 'error', translationKey: 'login.messages.errorGeneral' });
    }

    // Strip handled query parameters from the URL so the message does not reappear on refresh
    const cleanedParams = new URLSearchParams(Array.from(searchParams.entries()));
    cleanedParams.delete('error');
    cleanedParams.delete('message');

    const cleanedQuery = cleanedParams.toString();
    router.replace(cleanedQuery ? `/login?${cleanedQuery}` : '/login');
  }, [router, searchParams]);

  // Check if user is already logged in
  useEffect(() => {
    let isActive = true;

    const checkUser = async () => {
      const { data: { session } = { session: null }, error } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (error) {
        logError('login', 'Unable to verify session before rendering login form.', error);
        setMessage((prev) =>
          prev ?? {
            type: 'error',
            translationKey: 'login.messages.errorSession',
          }
        );
        return;
      }

      if (session) {
        router.replace(sanitizedRedirect);
      }
    };
    checkUser();
    return () => {
      isActive = false;
    };
  }, [router, sanitizedRedirect]);

  const handleEmailChange = (nextEmail: string) => {
    setEmail(nextEmail);
    setMessage((prev) => {
      if (!prev || prev.type === 'success') {
        return prev;
      }
      return null;
    });
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: 'info', translationKey: 'login.messages.sending' });

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanEmail) {
        setMessage({ type: 'error', translationKey: 'login.messages.errorInvalidEmail' });
        setIsLoading(false);
        return;
      }

      const callbackUrl = new URL('/auth/callback', window.location.origin);
      callbackUrl.searchParams.set('redirectTo', sanitizedRedirect);
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        const hasMessage =
          typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string';
        const status = typeof error === 'object' && error && 'status' in error ? (error as { status?: number }).status : undefined;

        if (status === 429) {
          setMessage({ type: 'error', translationKey: 'login.messages.errorRateLimit' });
        } else if (hasMessage) {
          setMessage({ type: 'error', text: (error as { message: string }).message });
        } else {
          setMessage({ type: 'error', translationKey: 'login.messages.errorSendLink' });
        }
      } else {
        setEmailSent(true);
        setMessage({
          type: 'success',
          translationKey: 'login.messages.successLinkSent',
        });
      }
    } catch (error) {
      logError('login', 'Unexpected error sending magic link.', error);
      setMessage({
        type: 'error',
        translationKey: 'login.messages.errorUnexpected',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = () => {
    setEmailSent(false);
    setMessage({
      type: 'info',
      translationKey: 'login.messages.infoResend',
    });
  };

  const instructionsId = emailSent ? 'login-instructions' : undefined;
  const messageId = message ? 'login-status-message' : undefined;
  const describedBy = [instructionsId, messageId].filter(Boolean).join(' ') || undefined;
  const messageToneClass = message
    ? message.type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : message.type === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-sky-200 bg-sky-50 text-sky-700'
    : '';

  return (
    <main
      className="psychocas-section flex min-h-screen items-center justify-center px-4 py-10 sm:px-6"
      aria-busy={isLoading}
    >
      <div className="psychocas-container fade-in-up w-full">
        <div className="login-grid">
          <section className="login-hero space-y-6">
            <span className="stat-pill stat-pill--info w-fit text-sm">
              <Sparkles className="h-4 w-4" />
              Psychočas
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold text-slate-900 lg:text-[2.4rem]">{t('login.title')}</h1>
              <p className="text-base text-slate-600 lg:text-lg">{t('login.subtitlePrompt')}</p>
            </div>
            <div className="login-illustration">🧠</div>
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {t('login.instructionsTitle')}
              </p>
              <ul className="login-list">
                <li>{t('login.instructionsSteps.first')}</li>
                <li>{t('login.instructionsSteps.second')}</li>
                <li>{t('login.instructionsSteps.third')}</li>
                <li>{t('login.instructionsSteps.fourth')}</li>
              </ul>
            </div>
          </section>

          <div className="psychocas-card auth-card login-card text-left" aria-live="polite">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1d4f7d] to-[#049edb] text-xl font-semibold text-white">
                  Ψ
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Psychočas ID</p>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {emailSent ? t('login.successTitle') : t('login.title')}
                  </h2>
                </div>
              </div>
              <p className="auth-card__subtitle text-slate-500">
                {emailSent ? t('login.subtitleSent') : t('login.subtitlePrompt')}
              </p>
            </div>

            {isStandalone && (
              <aside
                className="home-alert mt-4 text-left text-sm"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <div className="home-alert__icon">
                  <WifiOff className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{t('login.pwaBanner.title')}</p>
                  <p className="mt-1 text-sm">{t('login.pwaBanner.description')}</p>
                  <p className="mt-2 text-xs text-slate-500">{t('login.pwaBanner.retryHint')}</p>
                </div>
              </aside>
            )}

            {!emailSent ? (
              <form
                onSubmit={handleSendMagicLink}
                className="mt-6 space-y-6"
                aria-describedby={instructionsId}
                aria-busy={isLoading}
              >
                <div className="space-y-3">
                  <label htmlFor="email" className="text-sm font-medium text-slate-600">
                    {t('login.emailLabel')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className="psychocas-input"
                    placeholder={t('login.emailPlaceholder')}
                    required
                    disabled={isLoading}
                    autoFocus
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    enterKeyHint="send"
                    spellCheck={false}
                    aria-describedby={describedBy}
                    aria-invalid={message?.type === 'error' ? true : undefined}
                  />
                </div>

                <button
                  type="submit"
                  className="psychocas-button-primary"
                  disabled={isLoading || !email}
                >
                  {isLoading ? t('login.sendLinkLoading') : t('login.sendLink')}
                </button>
              </form>
            ) : (
              <div className="mt-6 space-y-6 text-left sm:text-center">
                <div className="flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#1d4f7d] to-[#049edb] text-white">
                    <MailCheck className="h-9 w-9" />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="auth-card__message text-center text-base text-slate-600">
                    {t('login.successDescription')} <br />
                    <strong className="text-slate-900">{email}</strong>
                  </p>
                </div>

                <div
                  id={instructionsId}
                  className="rounded-2xl border border-sky-100 bg-sky-50/70 p-5 text-left sm:text-center"
                >
                  <p className="mb-3 text-sm font-semibold text-slate-700">
                    {t('login.instructionsTitle')}
                  </p>
                  <ol className="list-decimal space-y-2 text-sm text-slate-600 sm:list-none sm:space-y-1 sm:px-0">
                    <li>{t('login.instructionsSteps.first')}</li>
                    <li>{t('login.instructionsSteps.second')}</li>
                    <li>{t('login.instructionsSteps.third')}</li>
                    <li>{t('login.instructionsSteps.fourth')}</li>
                  </ol>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-700">
                  {t('login.expirationNotice')}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isLoading}
                    className="psychocas-button-secondary"
                  >
                    {t('login.resendButton')}
                  </button>
                </div>

                <p className="text-sm text-slate-500">{t('login.helpText')}</p>
              </div>
            )}

            {message && (
              <div
                id={messageId}
                className={clsx('mt-6 rounded-2xl border px-4 py-3 text-sm shadow-sm', messageToneClass)}
                role={message.type === 'error' ? 'alert' : 'status'}
                aria-live={message.type === 'error' ? 'assertive' : 'polite'}
                aria-atomic="true"
              >
                {message.translationKey
                  ? message.params
                    ? formatMessage(message.translationKey, message.params)
                    : t(message.translationKey)
                  : message.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function LoginFallback() {
  const { t } = useLocale();
  return (
    <main className="psychocas-section flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="psychocas-container fade-in-up w-full max-w-2xl">
        <div className="psychocas-card auth-card text-center">
          <p>{t('login.fallbackLoading')}</p>
        </div>
      </div>
    </main>
  );
}

export default function Login() {
  return (
    <Suspense
      fallback={<LoginFallback />}
    >
      <LoginContent />
    </Suspense>
  );
}
