'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { logError } from '@/lib/logging';
import { useRouter, useSearchParams } from 'next/navigation';
import useLocale from '@/hooks/useLocale';
import { sanitizeRedirect } from '@/lib/navigation/redirect';

type MessageState = {
  type: 'success' | 'error' | 'info';
  translationKey?: string;
  text?: string;
  params?: Record<string, string | number>;
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, formatMessage } = useLocale();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);

  const requestedRedirect = searchParams.get('redirectTo');
  const sanitizedRedirect = useMemo(
    () => sanitizeRedirect(requestedRedirect),
    [requestedRedirect]
  );

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

  return (
    <main className="psychocas-section flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
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
              {emailSent ? t('login.subtitleSent') : t('login.subtitlePrompt')}
            </p>
          </div>

          {/* Email Form - Show when email not sent yet */}
          {!emailSent && (
            <form onSubmit={handleSendMagicLink} className="space-y-8">
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
          )}

          {/* Success State - Show after email sent */}
          {emailSent && (
            <div className="space-y-6 text-left sm:text-center">
              {/* Email Icon/Illustration */}
              <div className="mb-6 flex justify-center">
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1d4f7d 0%, #049edb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '40px'
                }}>
                  ✉️
                </div>
              </div>

              {/* Success Message */}
              <div className="space-y-3">
                <h2 className="text-2xl font-bold sm:text-[1.7rem]" style={{ color: '#333333' }}>
                  {t('login.successTitle')}
                </h2>
                <p className="auth-card__message">
                  {t('login.successDescription')}
                  <br />
                  <strong style={{ color: '#333333' }}>{email}</strong>
                </p>
              </div>

              {/* Instructions */}
              <div
                className="rounded-2xl p-5 sm:p-6"
                style={{
                  backgroundColor: '#f0f9ff',
                  borderLeft: '4px solid #049edb'
                }}
              >
                <p className="mb-3 text-sm font-semibold" style={{ color: '#333333' }}>
                  {t('login.instructionsTitle')}
                </p>
                <ol className="space-y-2 text-sm" style={{ color: '#666666', paddingLeft: '20px' }}>
                  <li>{t('login.instructionsSteps.first')}</li>
                  <li>{t('login.instructionsSteps.second')}</li>
                  <li>{t('login.instructionsSteps.third')}</li>
                  <li>{t('login.instructionsSteps.fourth')}</li>
                </ol>
              </div>

              {/* Expiration Warning */}
              <div className="rounded-xl p-4" style={{
                backgroundColor: '#fff3cd',
                borderLeft: '4px solid #f57c00'
              }}>
                <p className="text-sm" style={{ color: '#856404' }}>{t('login.expirationNotice')}</p>
              </div>

              {/* Resend Button */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLoading}
                  className="psychocas-button-secondary"
                >
                  {t('login.resendButton')}
                </button>
              </div>

              {/* Help Text */}
              <p className="pt-4 text-sm" style={{ color: '#999999' }}>{t('login.helpText')}</p>
            </div>
          )}

          {/* Message Display */}
          {message && (
            <div
              className={`mt-6 p-4 rounded-xl text-sm ${
                message.type === 'success'
                  ? 'status-active'
                  : message.type === 'error'
                    ? 'status-inactive'
                    : ''
              }`}
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
