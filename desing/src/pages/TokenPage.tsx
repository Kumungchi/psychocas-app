import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { getTokenCountdown, formatCountdown } from '@/lib/tokens'
import type { TokenCountdown } from '@/types'
import { Copy, RefreshCw, ArrowLeft, AlertCircle, Timer } from 'lucide-react'
import { toast } from 'sonner'

export function TokenPage() {
  const { id: discountId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [code, setCode] = useState<string | null>(null)
  const [validationUrl, setValidationUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<TokenCountdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const generateToken = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: fnError } = await supabase.functions.invoke('generate_token', {
      body: { discount_id: discountId },
    })

    if (fnError || data?.error) {
      const errMsg = data?.error || fnError?.message || 'unknown_error'
      if (errMsg === 'active_token_exists') setError('Již máte aktivní token. Počkejte na jeho vypršení.')
      else if (errMsg === 'membership_inactive') setError('Vaše členství není aktivní.')
      else if (errMsg === 'discount_not_found') setError('Sleva nebyla nalezena nebo není aktivní.')
      else setError('Nepodařilo se vygenerovat token. Zkuste to znovu.')
      setLoading(false)
      return
    }

    setCode(data.code)
    setExpiresAt(data.expires_at)
    setValidationUrl(data.validation_url)
    setLoading(false)
  }, [discountId])

  useEffect(() => { generateToken() }, [generateToken])

  useEffect(() => {
    if (!expiresAt) return
    const tick = () => setCountdown(getTokenCountdown(expiresAt))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  const isExpired = countdown?.isExpired ?? false
  const isWarning = !isExpired && countdown?.minutes === 0 && (countdown?.seconds ?? 60) <= 30

  const timerColor = isExpired
    ? 'var(--psychocas-status-red)'
    : isWarning ? '#f57c00'
    : 'var(--psychocas-status-green)'

  const copyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code)
      toast.success('Kód zkopírován do schránky')
    }
  }

  const regenerate = () => {
    setCode(null)
    setExpiresAt(null)
    setCountdown(null)
    generateToken()
  }

  return (
    <main className="psychocas-section min-h-[100dvh]">
      <div className="psychocas-container fade-in-up space-y-5 pt-4">

        {/* ── Header ──────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/discounts')}
            className="interactive-element"
            style={{
              background: 'var(--psychocas-white)',
              border: '1px solid #e0e0e0',
              borderRadius: '50%',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--psychocas-primary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 style={{ color: 'var(--psychocas-primary)', margin: 0 }}>Slevový kód</h1>
        </div>

        {/* ── Loading ─────────────────────────────────── */}
        {loading && (
          <div className="psychocas-card text-center py-12">
            <div
              className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto"
              style={{ borderColor: 'var(--psychocas-primary)' }}
            />
            <p className="mt-4" style={{ color: '#666666' }}>Generování tokenu...</p>
          </div>
        )}

        {/* ── Error ───────────────────────────────────── */}
        {error && (
          <div className="psychocas-card text-center py-10 space-y-4">
            <AlertCircle className="w-12 h-12 mx-auto" style={{ color: 'var(--psychocas-status-red)' }} />
            <p style={{ color: 'var(--psychocas-status-red)' }}>{error}</p>
            <button onClick={() => navigate('/discounts')} className="psychocas-button-primary" style={{ maxWidth: '16rem', margin: '0 auto' }}>
              Zpět na slevy
            </button>
          </div>
        )}

        {/* ── Token display ───────────────────────────── */}
        {!loading && !error && code && validationUrl && (
          <>
            {/* QR card */}
            <div className="psychocas-card text-center space-y-5">
              <p style={{ color: '#666666', fontSize: '0.9rem' }}>Ukažte QR kód nebo krátký kód u pokladny</p>

              {/* QR — fluid, never overflows */}
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
                <QRCodeSVG
                  value={validationUrl}
                  size={Math.min(200, typeof window !== 'undefined' ? window.innerWidth - 140 : 200)}
                  level="M"
                  bgColor="transparent"
                  fgColor={isExpired ? '#999999' : '#1d4f7d'}
                />
              </div>

              {/* Short code pill */}
              <div
                className="font-mono tracking-[0.18em] text-xl font-semibold py-3 px-6 rounded-2xl inline-block transition-all duration-500"
                style={{
                  backgroundColor: isExpired ? '#f8f8f8' : '#e8f4fd',
                  color: isExpired ? '#999999' : 'var(--psychocas-primary)',
                  letterSpacing: '0.2em',
                }}
              >
                {code}
              </div>

              {/* Countdown */}
              <div>
                <div className="flex items-center justify-center gap-2 mb-2" style={{ color: '#999999' }}>
                  <Timer className="w-4 h-4" />
                  <span style={{ fontSize: '0.85rem' }}>Zbývající čas</span>
                </div>
                <div className="text-4xl font-mono font-bold mb-3" style={{ color: timerColor }}>
                  {countdown ? formatCountdown(countdown) : '--:--'}
                </div>

                {/* Progress bar */}
                {countdown && !isExpired && (
                  <div className="w-full h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: '#eeeeee' }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${countdown.percentLeft}%`, backgroundColor: timerColor }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            {!isExpired ? (
              <button
                onClick={copyCode}
                className="psychocas-button-primary w-full"
              >
                <Copy className="w-5 h-5" />
                Kopírovat kód
              </button>
            ) : (
              <button
                onClick={regenerate}
                className="psychocas-button-primary w-full"
              >
                <RefreshCw className="w-5 h-5" />
                Vygenerovat nový kód
              </button>
            )}

            {/* Info card */}
            <div className="psychocas-card space-y-3" style={{ padding: '1.25rem' }}>
              <h3 style={{ color: 'var(--psychocas-text-gray)', marginBottom: '0.75rem' }}>Jak použít kód</h3>
              {[
                'Ukažte QR kód nebo krátký kód u pokladny',
                'Kód je platný 3 minuty od vygenerování',
                'Po vypršení můžete vygenerovat nový',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className="mt-[6px] flex-shrink-0 rounded-full"
                    style={{ width: 7, height: 7, backgroundColor: 'var(--psychocas-accent)', display: 'inline-block' }}
                  />
                  <span style={{ color: '#666666', fontSize: '0.9rem' }}>{text}</span>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </main>
  )
}
