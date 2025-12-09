'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { logError } from '@/lib/logging';
import { useRouter, useSearchParams } from 'next/navigation';
import useLocale from '@/hooks/useLocale';
import { sanitizeRedirect } from '@/lib/navigation/redirect';
import { computeStandaloneMode } from '@/lib/pwa/displayMode';

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
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
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

  // Surface any error returned by the callback handler
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

  const handleOtpChange = (nextOtp: string) => {
    // Only allow digits
    const digits = nextOtp.replace(/\D/g, '');
    setOtpCode(digits.substring(0, 6)); // Limit to 6 digits
    setMessage((prev) => {
      if (!prev || prev.type === 'success') {
        return prev;
      }
      return null;
    });
  };

  const handleSendOtp = async (e: React.FormEvent) => {
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

      // Use email OTP authentication
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false, // Users must be pre-created via provisioning script
        },
      });

      if (error) {
        const hasMessage =
          typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string';
        const status = typeof error === 'object' && error && 'status' in error ? (error as { status?: number }).status : undefined;

        if (status === 429) {
          setMessage({ type: 'error', translationKey: 'login.messages.errorRateLimit' });
        } else if (status === 400 && error.message?.includes('User not found')) {
          setMessage({
            type: 'error',
            text: 'Email address not authorized. Contact admin to be added to the system.'
          });
        } else if (hasMessage) {
          setMessage({ type: 'error', text: (error as { message: string }).message });
        } else {
          setMessage({ type: 'error', translationKey: 'login.messages.errorSendOtp' });
        }
      } else {
        setOtpSent(true);
        setMessage({
          type: 'success',
          translationKey: 'login.messages.successOtpSent',
        });
      }
    } catch (error) {
      logError('login', 'Unexpected error sending OTP.', error);
      setMessage({
        type: 'error',
        translationKey: 'login.messages.errorUnexpected',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: 'info', translationKey: 'login.messages.verifying' });

    try {
      const cleanEmail = email.trim().toLowerCase();

      const { error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: otpCode,
        type: 'email',
      });

      if (error) {
        const hasMessage =
          typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string';

        if (hasMessage && error.message.includes('expired')) {
          setMessage({ type: 'error', translationKey: 'login.messages.errorOtpExpired' });
        } else if (hasMessage && error.message.includes('invalid')) {
          setMessage({ type: 'error', translationKey: 'login.messages.errorOtpInvalid' });
        } else if (hasMessage) {
          setMessage({ type: 'error', text: (error as { message: string }).message });
        } else {
          setMessage({ type: 'error', translationKey: 'login.messages.errorVerifyOtp' });
        }
      } else {
        setMessage({
          type: 'success',
          translationKey: 'login.messages.successLogin',
        });
        // Redirect happens automatically via middleware
        router.replace(sanitizedRedirect);
      }
    } catch (error) {
      logError('login', 'Unexpected error verifying OTP.', error);
      setMessage({
        type: 'error',
        translationKey: 'login.messages.errorUnexpected',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = () => {
    setOtpSent(false);
    setOtpCode('');
    setMessage({
      type: 'info',
      translationKey: 'login.messages.infoResend',
    });
  };

  const instructionsId = otpSent ? 'login-instructions' : undefined;
  const messageId = message ? 'login-status-message' : undefined;
  const describedBy = [instructionsId, messageId].filter(Boolean).join(' ') || undefined;

  return (
    <main
      className="psychocas-section flex min-h-screen items-center justify-center px-4 py-8 sm:px-6"
      aria-busy={isLoading}
    >
      <div className="psychocas-container fade-in-up w-full max-w-2xl">
        <div className="psychocas-card auth-card text-center">
          {/* Logo */}
          <div className="mb-6 flex justify-center sm:mb-8">
            <svg
              width="100"
              height="100"
              viewBox="-60 -60 120 120"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#1d4f7d', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#049edb', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              <circle cx="0" cy="0" r="55" fill="url(#logoGradient)" />
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

          {/* Welcome Section */}
          <div className="mb-10 space-y-3 sm:mb-12">
            <h1 className="mb-1 text-3xl font-semibold sm:text-[2rem]" style={{ color: '#1d4f7d' }}>
              {t('login.title')}
            </h1>
            <p className="auth-card__subtitle">
              {otpSent ? t('login.subtitleOtpSent') : t('login.subtitlePrompt')}
            </p>
          </div>

          {isStandalone && (
            <aside
              className="mb-8 text-left"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              style={{
                backgroundColor: '#eef4ff',
                borderRadius: '1rem',
                border: '1px dashed #8ea6ff',
                color: '#1d4f7d',
                padding: '1.25rem',
              }}
            >
              <p className="text-sm font-semibold">{t('login.pwaBanner.title')}</p>
              <p className="mt-2 text-sm">{t('login.pwaBanner.description')}</p>
              <p className="mt-3 text-xs" style={{ color: '#405089' }}>
                {t('login.pwaBanner.retryHint')}
              </p>
            </aside>
          )}

          {/* Email Form - Show when OTP not sent yet */}
          {!otpSent && (
            <form
              onSubmit={handleSendOtp}
              className="space-y-8"
              aria-describedby={instructionsId}
              aria-busy={isLoading}
            >
              <div className="space-y-3 text-left">
                <label htmlFor="email" style={{ color: '#333333' }}>
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
                {isLoading ? t('login.sendOtpLoading') : t('login.sendOtp')}
              </button>
            </form>
          )}

          {/* OTP Verification Form - Show after OTP sent */}
          {otpSent && (
            <div className="space-y-6">
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                {/* Email Display */}
                <div className="rounded-xl p-4" style={{
                  backgroundColor: '#f0f9ff',
                  borderLeft: '4px solid #049edb'
                }}>
                  <p className="text-sm" style={{ color: '#666666' }}>
                    {t('login.otpSentTo')}
                  </p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: '#333333' }}>
                    {email}
                  </p>
                </div>

                {/* OTP Input */}
                <div className="space-y-3 text-left">
                  <label htmlFor="otp" style={{ color: '#333333' }}>
                    {t('login.otpLabel')}
                  </label>
                  <input
                    id="otp"
                    type="text"
                    value={otpCode}
                    onChange={(e) => handleOtpChange(e.target.value)}
                    className="psychocas-input text-center text-2xl tracking-widest"
                    placeholder="000000"
                    required
                    disabled={isLoading}
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    enterKeyHint="done"
                    aria-describedby={describedBy}
                    aria-invalid={message?.type === 'error' ? true : undefined}
                  />
                  <p className="text-xs" style={{ color: '#666666' }}>
                    {t('login.otpHint')}
                  </p>
                </div>

                <button
                  type="submit"
                  className="psychocas-button-primary"
                  disabled={isLoading || otpCode.length !== 6}
                >
                  {isLoading ? t('login.verifyOtpLoading') : t('login.verifyOtp')}
                </button>
              </form>

              {/* Resend Button */}
              <div className="pt-4 border-t" style={{ borderColor: '#e5e7eb' }}>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLoading}
                  className="psychocas-button-secondary"
                >
                  {t('login.resendOtp')}
                </button>
              </div>

              {/* Help Text */}
              <p className="pt-4 text-sm" style={{ color: '#999999' }}>{t('login.helpText')}</p>
            </div>
          )}

          {/* Message Display */}
          {message && (
            <div
              id={messageId}
              className={`mt-6 rounded-xl p-4 text-sm ${
                message.type === 'success'
                  ? 'status-active'
                  : message.type === 'error'
                    ? 'status-inactive'
                    : ''
              }`}
              role={message.type === 'error' ? 'alert' : 'status'}
              aria-live={message.type === 'error' ? 'assertive' : 'polite'}
              aria-atomic="true"
              style={
                message.type === 'info'
                  ? {
                      backgroundColor: '#e8f1ff',
                      border: '1px solid #bcd0ff',
                      color: '#1d4f7d',
                    }
                  : undefined
              }
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
