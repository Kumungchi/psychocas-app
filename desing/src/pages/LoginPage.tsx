import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { toast } from 'sonner'
import PsychocasLogo from '@/components/PsychocasLogo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Mail, ArrowRight, ShieldCheck } from 'lucide-react'

type Step = 'email' | 'otp'

export function LoginPage() {
  const { signIn, verifyOtp } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const otpSubmittingRef = useRef(false)

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email)
    setLoading(false)
    if (error) {
      toast.error(error)
    } else {
      setStep('otp')
      toast.success(t.auth.codeSentToast)
    }
  }

  async function submitOtp(code: string) {
    if (code.length !== 6 || otpSubmittingRef.current) return
    otpSubmittingRef.current = true
    setLoading(true)
    const { error } = await verifyOtp(email, code)
    setLoading(false)
    otpSubmittingRef.current = false
    if (error) { toast.error(error); setOtp('') }
    else navigate('/')
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitOtp(otp)
  }

  return (
    <main
      id="main-content"
      className="psychocas-section flex min-h-[100dvh] items-center justify-center"
      // role="main" is implicit on <main> — screen readers announce it automatically
    >
      {/* Language switcher — top right, absolute so it doesn't affect card layout */}
      <div style={{ position: 'fixed', top: 'max(1rem, var(--safe-area-inset-top))', right: '1rem', zIndex: 10 }}>
        <LanguageSwitcher />
      </div>

      <div className="psychocas-container fade-in-up w-full" role="region" aria-label={t.auth.welcome}>
        <div className="psychocas-card auth-card text-center relative overflow-hidden">

          <div className="mb-6 relative z-10">
            <PsychocasLogo
              size={typeof window !== 'undefined' && window.innerWidth < 380 ? 70 : 90}
              className="mx-auto mb-5"
            />
            <h1 className="font-semibold mb-2" style={{ color: 'var(--psychocas-primary)', fontSize: 'clamp(1.35rem, 5vw, 1.6rem)' }}>
              {t.auth.welcome}
            </h1>
            <p className="auth-card__message text-muted-foreground" style={{ fontSize: 'clamp(0.875rem, 3vw, 1rem)' }}>
              {step === 'email' ? t.auth.subtitle : `${t.auth.codeSent} ${email}`}
            </p>
          </div>

          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit} className="space-y-6 relative z-10" noValidate>
              <div className="space-y-2 text-left">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-1 ml-1"
                  style={{ color: 'var(--psychocas-text-gray)' }}
                >
                  {t.auth.emailLabel}
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: '#aaaaaa' }}
                    aria-hidden="true"
                  />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="psychocas-input w-full"
                    style={{ paddingLeft: '2.75rem' }}
                    placeholder={t.auth.emailPlaceholder}
                    required
                    disabled={loading}
                    aria-required="true"
                    aria-label={t.auth.emailLabel}
                  />
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  className="psychocas-button-primary w-full"
                  disabled={loading}
                  aria-busy={loading}
                >
                  {loading ? t.auth.sending : t.auth.sendCode}
                  {!loading && <ArrowRight className="w-5 h-5 ml-1" aria-hidden="true" />}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-8 text-center flex flex-col items-center relative z-10">
              <ShieldCheck className="w-12 h-12 mx-auto" style={{ color: 'var(--psychocas-accent)', opacity: 0.9 }} aria-hidden="true" />

              <div
                className="w-full flex justify-center"
                role="group"
                aria-label="6-místný ověřovací kód"
              >
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  pattern={REGEXP_ONLY_DIGITS}
                  onComplete={(code) => { setOtp(code); void submitOtp(code) }}
                  containerClassName="flex justify-center w-full"
                  aria-label="Zadejte 6místný kód"
                >
                  <InputOTPGroup className="flex w-full gap-[clamp(0.25rem,2vw,0.75rem)] justify-center">
                    {[0,1,2,3,4,5].map(i => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="flex-1 min-w-0 h-[3.5rem] text-xl font-bold bg-muted border-2 border-transparent rounded-xl transition-all"
                        style={{ maxWidth: '3.75rem' }}
                        aria-label={`Číslice ${i + 1}`}
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <div className="w-full space-y-4">
                <button
                  type="submit"
                  className="psychocas-button-primary w-full"
                  disabled={loading || otp.length !== 6}
                  aria-busy={loading}
                  aria-disabled={otp.length !== 6}
                >
                  {loading ? t.auth.verifying : t.auth.confirmCode}
                  {!loading && <ArrowRight className="w-5 h-5 ml-1" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setOtp('') }}
                  className="text-sm font-medium mt-4 block mx-auto text-muted-foreground hover:text-primary transition-colors"
                >
                  {t.auth.backToEmail}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
