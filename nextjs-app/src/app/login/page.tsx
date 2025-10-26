'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { logError } from '@/lib/logging';
import { useRouter, useSearchParams } from 'next/navigation';
import useLocale from '@/hooks/useLocale';
import { sanitizeRedirect } from '@/lib/navigation/redirect';
import { computeStandaloneMode } from '@/lib/pwa/displayMode';
import PsychocasLogo from '@/components/PsychocasLogo';
import { MailCheck, ShieldCheck, Smartphone } from 'lucide-react';

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

  const heroHighlights = [
    { icon: MailCheck, text: t('login.instructionsSteps.first') },
    { icon: Smartphone, text: t('login.instructionsSteps.second') },
    { icon: ShieldCheck, text: t('login.instructionsSteps.third') },
  ];

  const statusClass = message
    ? [
        'auth-status',
        message.type === 'success'
          ? 'auth-status--success'
          : message.type === 'error'
            ? 'auth-status--error'
            : 'auth-status--info',
      ].join(' ')
    : '';

  return (
    <main
      className="psychocas-section flex min-h-screen items-center justify-center px-4 py-10 sm:px-6"
      aria-busy={isLoading}
    >
      <div className="auth-shell fade-in-up">
        <section className="psychocas-card auth-card auth-shell__card" aria-labelledby="login-title">
          <header className="auth-shell__header">
            <PsychocasLogo size={88} gradientId="loginLogoGradient" />
            <div>
              <h1 id="login-title" className="auth-shell__title">
                {t('login.title')}
              </h1>
              <p className="auth-shell__subtitle">
                {emailSent ? t('login.subtitleSent') : t('login.subtitlePrompt')}
              </p>
            </div>
          </header>

          {isStandalone && (
            <aside className="auth-pwa" role="status" aria-live="polite" aria-atomic="true">
              <p className="font-semibold text-sm">{t('login.pwaBanner.title')}</p>
              <p>{t('login.pwaBanner.description')}</p>
              <p className="auth-pwa__hint">{t('login.pwaBanner.retryHint')}</p>
            </aside>
          )}

          {/* Email Form - Show when email not sent yet */}
          {!emailSent && (
            <form
              onSubmit={handleSendMagicLink}
              className="auth-shell__form"
              aria-describedby={instructionsId}
              aria-busy={isLoading}
            >
              <div className="auth-shell__field">
                <label className="auth-shell__label" htmlFor="email">
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

              <div className="auth-shell__actions">
                <button
                  type="submit"
                  className="psychocas-button-primary"
                  disabled={isLoading || !email}
                >
                  {isLoading ? t('login.sendLinkLoading') : t('login.sendLink')}
                </button>
              </div>
            </form>
          )}

          {/* Success State - Show after email sent */}
          {emailSent && (
            <div className="space-y-6 text-left sm:text-center">
              <div className="flex justify-center">
                <div className="auth-success-icon" aria-hidden="true">
                  <MailCheck className="h-10 w-10" strokeWidth={1.75} />
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl font-bold sm:text-[1.7rem]" style={{ color: '#333333' }}>
                  {t('login.successTitle')}
                </h2>
                <p className="auth-card__message">
                  {t('login.successDescription')}
                  <br />
                  <span className="auth-success-email">{email}</span>
                </p>
              </div>

              <div id={instructionsId} className="auth-instructions">
                <p className="auth-instructions__title">{t('login.instructionsTitle')}</p>
                <ol className="auth-instructions__list">
                  <li>{t('login.instructionsSteps.first')}</li>
                  <li>{t('login.instructionsSteps.second')}</li>
                  <li>{t('login.instructionsSteps.third')}</li>
                  <li>{t('login.instructionsSteps.fourth')}</li>
                </ol>
              </div>

              <div className="auth-expiration">{t('login.expirationNotice')}</div>

              <div className="pt-2 sm:pt-4">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLoading}
                  className="psychocas-button-secondary"
                >
                  {t('login.resendButton')}
                </button>
              </div>

              <p className="auth-help">{t('login.helpText')}</p>
            </div>
          )}

          {/* Message Display */}
          {message && (
            <div
              id={messageId}
              className={`${statusClass} mt-2`}
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
        </section>

        <aside className="auth-shell__hero" aria-hidden="true">
          <div className="space-y-6">
            <PsychocasLogo size={120} gradientId="loginHeroGradient" />
            <h2 className="auth-shell__hero-title">{t('login.title')}</h2>
            <p className="auth-shell__hero-text">{t('login.subtitlePrompt')}</p>
          </div>

          <div className="auth-shell__divider" />

          <ul className="auth-shell__hero-list">
            {heroHighlights.map(({ icon: Icon, text }) => (
              <li key={text} className="auth-shell__hero-item">
                <span className="auth-shell__hero-icon">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <p className="auth-shell__footnote">{t('login.helpText')}</p>
        </aside>
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
