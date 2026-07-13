'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { OTPInput, REGEXP_ONLY_DIGITS, type SlotProps } from 'input-otp';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { api } from '../../convex/_generated/api';
import PsychocasLogo from '@/components/PsychocasLogo';
import useLocale from '@/hooks/useLocale';
import { sanitizeRedirect } from '@/lib/navigation/redirect';
import { colors, radii, shadows, spacing, typography } from '@/ui/theme';

const OTP_LENGTH = 8;
const RESEND_COOLDOWN_SECONDS = 60;

type LoginStep = 'email' | 'code';
type LoginState =
  | { type: 'idle'; text: string }
  | { type: 'info'; text: string }
  | { type: 'success'; text: string }
  | { type: 'error'; text: string };

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isEmailDeliveryError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('email_delivery_failed') ||
    message.includes('email_provider_unavailable') ||
    message.includes('providererrorname')
  );
}

function OtpSlot({ char, hasFakeCaret, isActive }: SlotProps) {
  return (
    <div
      className="relative flex min-w-0 items-center justify-center font-mono text-xl font-semibold"
      style={{
        aspectRatio: '0.88',
        border: `1px solid ${isActive ? colors.accent : colors.border}`,
        borderRadius: radii.sm,
        background: isActive ? colors.brandSurface : colors.background,
        boxShadow: isActive ? `0 0 0 2px ${colors.accentMuted}` : 'none',
        color: colors.textPrimary,
      }}
    >
      {char}
      {hasFakeCaret && (
        <span
          aria-hidden
          className="pointer-events-none absolute h-6 w-px animate-pulse"
          style={{ background: colors.brandPrimary }}
        />
      )}
    </div>
  );
}

export default function ConvexLoginPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signOut } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { tr } = useLocale();
  const viewer = useQuery(api.members.viewer, isAuthenticated ? {} : 'skip');
  const ensureViewer = useMutation(api.members.ensureViewer);
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const [state, setState] = useState<LoginState>({
    type: 'idle',
    text: 'Použij email, pod kterým tě eviduje Psychočas.',
  });
  const syncStartedRef = useRef(false);
  const deniedSignOutRef = useRef(false);

  const requestedRedirect = searchParams.get('redirectTo');
  const sanitizedRedirect = useMemo(() => sanitizeRedirect(requestedRedirect), [requestedRedirect]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!isAuthenticated || !viewer || syncStartedRef.current) return;

    if (viewer.status === 'ready') {
      router.replace(sanitizedRedirect);
      return;
    }

    if (viewer.status === 'not_allowed') {
      if (deniedSignOutRef.current) return;
      deniedSignOutRef.current = true;
      void signOut().finally(() => {
        setStep('email');
        setOtp('');
        setState({
          type: 'error',
          text: 'Členství pro tento email není aktivní. Obrať se prosím na Psychočas.',
        });
      });
      return;
    }

    if (viewer.status !== 'needs_sync') return;

    syncStartedRef.current = true;
    setState({ type: 'info', text: 'Ověřuji členství…' });

    void ensureViewer()
      .then((result) => {
        if (result.status === 'ready') {
          router.replace(sanitizedRedirect);
          return;
        }

        void signOut();
        setStep('email');
        setState({
          type: 'error',
          text: 'Členství pro tento email není aktivní. Obrať se prosím na Psychočas.',
        });
        syncStartedRef.current = false;
      })
      .catch(() => {
        setState({
          type: 'error',
          text: 'Členství se teď nepodařilo ověřit. Zkus to prosím znovu.',
        });
        syncStartedRef.current = false;
      });
  }, [ensureViewer, isAuthenticated, router, sanitizedRedirect, signOut, viewer]);

  const requestOtp = async (cleanEmail: string) => {
    setIsSubmitting(true);
    setState({ type: 'info', text: 'Odesílám kód…' });
    let shouldShowCodeStep = true;

    try {
      await signIn('resend-otp', { email: cleanEmail });
    } catch (error) {
      if (isEmailDeliveryError(error)) {
        shouldShowCodeStep = false;
        setState({
          type: 'error',
          text: 'Email se teď nepodařilo odeslat. Zkus to prosím za chvíli, nebo kontaktuj Psychočas.',
        });
      }
      // The same screen is shown for unknown addresses to avoid exposing membership records.
    } finally {
      if (shouldShowCodeStep) {
        setSubmittedEmail(cleanEmail);
        setStep('code');
        setOtp('');
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setState({
          type: 'success',
          text: 'Pokud je email evidovaný jako aktivní, dorazí na něj přihlašovací kód.',
        });
      }
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setState({ type: 'error', text: 'Zadej prosím platný email.' });
      return;
    }

    await requestOtp(cleanEmail);
  };

  const handleCodeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (otp.length !== OTP_LENGTH) {
      setState({ type: 'error', text: 'Doplň celý osmimístný kód.' });
      return;
    }

    setIsSubmitting(true);
    setState({ type: 'info', text: 'Ověřuji kód a členství…' });

    try {
      const result = await signIn('resend-otp', {
        email: submittedEmail,
        code: otp,
      });
      if (!result.signingIn) {
        throw new Error('sign_in_failed');
      }
      setState({ type: 'success', text: 'Přihlášení proběhlo. Otevírám aplikaci…' });
    } catch {
      setState({
        type: 'error',
        text: 'Kód není platný nebo už vypršel. Zkontroluj ho, případně si pošli nový.',
      });
      setOtp('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isSubmitting || !submittedEmail) return;
    await requestOtp(submittedEmail);
  };

  const handleChangeEmail = () => {
    setStep('email');
    setOtp('');
    setSubmittedEmail('');
    setState({ type: 'idle', text: 'Použij email, pod kterým tě eviduje Psychočas.' });
  };

  const waitingForViewer = isAuthenticated && viewer === undefined;
  const busy = isSubmitting || authLoading || waitingForViewer;

  return (
    <main
      className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-6"
      aria-busy={busy}
      style={{ background: colors.backgroundMuted }}
    >
      <section
        className="w-full max-w-[430px]"
        style={{
          background: colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: radii.lg,
          boxShadow: shadows.md,
          padding: 'clamp(1.25rem, 5vw, 2rem)',
        }}
      >
        <div className="mb-7 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <PsychocasLogo size={48} gradientId="convexLoginLogo" />
            <div className="min-w-0">
              <p
                className="text-sm font-semibold"
                style={{ color: colors.brandPrimary, fontFamily: typography.heading }}
              >
                Psychočas
              </p>
              <h1
                className="text-xl font-semibold"
                style={{ color: colors.textPrimary, fontFamily: typography.heading }}
              >
                {tr('Přihlášení členů')}
              </h1>
            </div>
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              aria-label={tr('Informace k přihlášení')}
              aria-expanded={infoOpen}
              onClick={() => setInfoOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center"
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: radii.full,
                color: colors.brandPrimary,
                background: infoOpen ? colors.brandSurface : colors.background,
              }}
            >
              <Info size={18} />
            </button>
            {infoOpen && (
              <div
                role="dialog"
                aria-label={tr('Informace k přihlášení')}
                className="absolute right-0 top-12 z-10 w-[min(18rem,calc(100vw-3rem))]"
                style={{
                  background: colors.background,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radii.lg,
                  boxShadow: shadows.md,
                  color: colors.textSecondary,
                  padding: spacing.lg,
                }}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                    {tr('Jak se přihlásit')}
                  </p>
                  <button
                    type="button"
                    aria-label={tr('Zavřít informace')}
                    onClick={() => setInfoOpen(false)}
                    className="flex h-7 w-7 items-center justify-center"
                    style={{ color: colors.textSecondary }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-sm leading-6">
                  {tr('Zadej svůj členský email. Přijde ti jednorázový kód platný 10 minut. Pokud email nedorazí, zkontroluj také složku Hromadné nebo Spam.')}
                </p>
              </div>
            )}
          </div>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-5">
            <label className="block space-y-2" htmlFor="convex-login-email">
              <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                {tr('Členský email')}
              </span>
              <div className="relative">
                <Mail
                  aria-hidden
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: colors.textSecondary }}
                />
                <input
                  id="convex-login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="jmeno@example.cz"
                  autoComplete="email"
                  autoCapitalize="none"
                  inputMode="email"
                  enterKeyHint="send"
                  spellCheck={false}
                  disabled={busy}
                  autoFocus
                  className="w-full"
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radii.md,
                    color: colors.textPrimary,
                    minHeight: 48,
                    padding: '0 0.9rem 0 2.5rem',
                    outline: 'none',
                  }}
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="flex w-full items-center justify-center gap-2 font-semibold"
              style={{
                minHeight: 48,
                borderRadius: radii.md,
                background: busy || !email.trim() ? colors.neutralSurface : colors.brandPrimary,
                color: busy || !email.trim() ? colors.textSecondary : colors.background,
              }}
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {tr('Poslat přihlašovací kód')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit} className="space-y-5">
            <div>
              <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                {tr('Kód z emailu')}
              </p>
              <p className="mt-1 break-all text-sm" style={{ color: colors.textSecondary }}>
                {tr('Odesláno na')} <strong style={{ color: colors.textPrimary }}>{submittedEmail}</strong>
              </p>
            </div>

            <OTPInput
              value={otp}
              onChange={setOtp}
              maxLength={OTP_LENGTH}
              pattern={REGEXP_ONLY_DIGITS}
              autoComplete="one-time-code"
              inputMode="numeric"
              disabled={busy}
              autoFocus
              aria-label={tr('Osmimístný přihlašovací kód')}
              containerClassName="w-full"
              render={({ slots }) => (
                <div className="grid w-full grid-cols-[repeat(4,minmax(0,1fr))_0.5rem_repeat(4,minmax(0,1fr))] gap-1">
                  {slots.slice(0, 4).map((slot, index) => (
                    <OtpSlot key={index} {...slot} />
                  ))}
                  <span aria-hidden />
                  {slots.slice(4).map((slot, index) => (
                    <OtpSlot key={index + 4} {...slot} />
                  ))}
                </div>
              )}
            />

            <button
              type="submit"
              disabled={busy || otp.length !== OTP_LENGTH}
              className="flex w-full items-center justify-center gap-2 font-semibold"
              style={{
                minHeight: 48,
                borderRadius: radii.md,
                background:
                  busy || otp.length !== OTP_LENGTH ? colors.neutralSurface : colors.brandPrimary,
                color:
                  busy || otp.length !== OTP_LENGTH ? colors.textSecondary : colors.background,
              }}
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              {tr('Ověřit a přihlásit')}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleChangeEmail}
                disabled={busy}
                className="flex min-h-11 items-center justify-center gap-2 text-sm font-medium"
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radii.md,
                  color: colors.textPrimary,
                }}
              >
                <ArrowLeft size={16} />
                {tr('Změnit email')}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={busy || cooldown > 0}
                className="flex min-h-11 items-center justify-center gap-2 text-sm font-medium"
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radii.md,
                  color: cooldown > 0 ? colors.textSecondary : colors.brandPrimary,
                }}
              >
                <RefreshCw size={16} />
                {cooldown > 0
                  ? tr('Znovu za {seconds} s').replace('{seconds}', String(cooldown))
                  : tr('Poslat znovu')}
              </button>
            </div>
          </form>
        )}

        <div
          className="mt-5 flex items-start gap-3 text-sm leading-5"
          role={state.type === 'error' ? 'alert' : 'status'}
          aria-live={state.type === 'error' ? 'assertive' : 'polite'}
          style={{
            background:
              state.type === 'error'
                ? colors.dangerSurface
                : state.type === 'success'
                  ? colors.successSurface
                  : colors.backgroundMuted,
            border: `1px solid ${state.type === 'error' ? '#FECACA' : colors.border}`,
            borderRadius: radii.md,
            color:
              state.type === 'error'
                ? colors.dangerStrong
                : state.type === 'success'
                  ? colors.success
                  : colors.textSecondary,
            padding: spacing.md,
          }}
        >
          {state.type === 'success' ? (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          ) : (
            <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          )}
          <p>{tr(state.text)}</p>
        </div>
      </section>
    </main>
  );
}
