import { useLang } from '@/contexts/LanguageContext'

const FLAG: Record<string, string> = { cs: '🇨🇿', en: '🇬🇧' }
const LABELS: Record<string, string> = { cs: 'CZ', en: 'EN' }

/**
 * A pill-shaped language toggle button, designed to sit in any page header.
 * Accessible: has role="switch", aria-checked, and an aria-label.
 */
export function LanguageSwitcher() {
  const { locale, setLocale } = useLang()
  const next = locale === 'cs' ? 'en' : 'cs'

  return (
    <button
      role="switch"
      aria-checked={locale === 'en'}
      aria-label={locale === 'cs' ? 'Switch to English' : 'Přepnout do češtiny'}
      onClick={() => setLocale(next)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.375rem 0.75rem',
        borderRadius: '999px',
        border: '1.5px solid rgba(29,79,125,0.15)',
        backgroundColor: 'var(--psychocas-white)',
        color: 'var(--psychocas-primary)',
        fontSize: '0.8rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        minWidth: 60,
        minHeight: 36, // WCAG 2.5.5 touch target
        userSelect: 'none',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(29,79,125,0.15)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <span aria-hidden="true">{FLAG[locale]}</span>
      <span>{LABELS[locale]}</span>
    </button>
  )
}
