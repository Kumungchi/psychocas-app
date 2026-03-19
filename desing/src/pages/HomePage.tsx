import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { getRoleLabel, hasRole } from '@/lib/auth'
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt'
import PsychocasLogo from '@/components/PsychocasLogo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import {
  CheckCircle, XCircle, Tag, Settings, BarChart3,
  LogOut, Smartphone, ChevronRight, CalendarDays, WalletCards,
} from 'lucide-react'
import { useState, useEffect } from 'react'

export function HomePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { t } = useLang()

  const [showPWA, setShowPWA] = useState(false)
  const [hasSeenPWA, setHasSeenPWA] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem('pwa-prompt-seen')
    if (!seen) {
      const timer = setTimeout(() => setShowPWA(true), 2000)
      return () => clearTimeout(timer)
    }
    setHasSeenPWA(true)
  }, [])

  const closePWA = () => {
    setShowPWA(false)
    localStorage.setItem('pwa-prompt-seen', 'true')
    setHasSeenPWA(true)
  }

  if (!user) return null

  const isActive = user.is_membership_active
  const expiryDate = user.membership_expires_at
    ? new Date(user.membership_expires_at).toLocaleDateString('cs-CZ', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '—'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const firstName = user.full_name.split(' ')[0]

  return (
    <main className="psychocas-section min-h-[100dvh] pb-8">
      <div className="psychocas-container fade-in-up space-y-5 pt-6">

        {/* ── Hero header ─────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm mb-0.5" style={{ color: '#999999' }}>{t.home.greeting}</p>
            <h1 style={{ color: 'var(--psychocas-primary)', margin: 0 }}>{firstName}</h1>
            <p className="text-xs mt-1" style={{ color: '#bbbbbb' }}>{getRoleLabel(user.role)}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <PsychocasLogo size={52} aria-hidden="true" />
          </div>
        </div>

        {/* ── Membership status card ───────────────────── */}
        <div
          className="psychocas-card"
          style={{
            background: isActive
              ? 'linear-gradient(135deg, #1d4f7d 0%, #049edb 100%)'
              : 'linear-gradient(135deg, #b0bec5 0%, #90a4ae 100%)',
            color: '#fff',
            cursor: 'default',
          }}
        >
          {/* Top row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {isActive
                ? <CheckCircle className="w-5 h-5" style={{ opacity: 0.9 }} />
                : <XCircle className="w-5 h-5" style={{ opacity: 0.9 }} />}
              <span className="font-medium text-sm" style={{ opacity: 0.9 }}>
                {isActive ? 'Členství aktivní' : 'Členství neaktivní'}
              </span>
            </div>
            <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              Psychočas
            </span>
          </div>

          {/* Name + Expiry */}
          <div className="mb-5">
            <p className="text-lg font-semibold tracking-wide">{user.full_name}</p>
            <p className="text-sm" style={{ opacity: 0.75 }}>{user.email}</p>
          </div>

          {/* Expiry row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2" style={{ opacity: 0.85 }}>
              <CalendarDays className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs">{t.home.expiryPrefix}</span>
            </div>
            <span className="text-sm font-semibold">{expiryDate}</span>
          </div>
        </div>

        {/* ── Primary CTA ─────────────────────────────── */}
        {isActive && (
          <button
            onClick={() => navigate('/discounts')}
            className="psychocas-button-primary w-full"
            aria-label={t.home.redeemDiscount}
          >
            <Tag className="w-5 h-5" aria-hidden="true" />
            {t.home.redeemDiscount}
            <ChevronRight className="w-5 h-5 ml-auto" aria-hidden="true" />
          </button>
        )}

        {/* ── Quick actions ────────────────────────────── */}
        <div className="psychocas-card" style={{ padding: '0.5rem' }}>
          <ActionRow
            icon={<WalletCards className="w-5 h-5" style={{ color: '#049edb' }} />}
            label="Savings Passport"
            onClick={() => navigate('/passport')}
          />
          <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '0 1rem' }} />
          {hasRole(user.role, 'manager') && (
            <>
              <ActionRow
                icon={<Settings className="w-5 h-5" style={{ color: '#049edb' }} />}
                label="Partneři a slevy"
                onClick={() => navigate('/manage')}
              />
              <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '0 1rem' }} />
              <ActionRow
                icon={<BarChart3 className="w-5 h-5" style={{ color: '#049edb' }} />}
                label="Statistiky"
                onClick={() => navigate('/stats')}
              />
              <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '0 1rem' }} />
            </>
          )}
          {hasSeenPWA && (
            <>
              <ActionRow
                icon={<Smartphone className="w-5 h-5" style={{ color: '#049edb' }} />}
                label="Nainstalovat aplikaci"
                onClick={() => setShowPWA(true)}
              />
              <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '0 1rem' }} />
            </>
          )}
          <ActionRow
            icon={<LogOut className="w-5 h-5" style={{ color: 'var(--psychocas-status-red)' }} />}
            label="Odhlásit se"
            labelColor="var(--psychocas-status-red)"
            onClick={handleSignOut}
          />
        </div>

        {/* ── Stats strip ──────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <StatBlock value={t.home.tokenValidityMin} label={t.home.tokenValidity} />
          <StatBlock value={t.home.availabilityVal} label={t.home.availability} />
        </div>

      </div>

      <PWAInstallPrompt isOpen={showPWA} onClose={closePWA} />
    </main>
  )
}

/* ─── Sub-components ─────────────────────────────── */

function ActionRow({
  icon, label, labelColor = 'var(--psychocas-text-gray)', onClick,
}: {
  icon: React.ReactNode
  label: string
  labelColor?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 active:bg-gray-50"
      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
    >
      {icon}
      <span style={{ color: labelColor, flex: 1, textAlign: 'left', fontSize: '0.95rem' }}>{label}</span>
      <ChevronRight className="w-4 h-4" style={{ color: '#cccccc' }} />
    </button>
  )
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="psychocas-card text-center" style={{ padding: '1rem' }}>
      <div className="text-xl font-semibold mb-1" style={{ color: 'var(--psychocas-primary)' }}>{value}</div>
      <div className="text-xs" style={{ color: '#999999' }}>{label}</div>
    </div>
  )
}
