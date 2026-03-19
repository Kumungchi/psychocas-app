import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { translations, type Locale } from '@/lib/i18n'

// Use a union of both locale shapes so either locale's string values are accepted
type AnyTranslations = typeof translations['cs'] | typeof translations['en']

interface LanguageContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: AnyTranslations
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem('psychocas-locale')
    return (saved === 'cs' || saved === 'en') ? saved : 'cs'
  })

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    localStorage.setItem('psychocas-locale', l)
    // Update the HTML lang attribute for screen readers
    document.documentElement.lang = l
  }

  // Sync HTML lang on initial render
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: translations[locale] }}>
      {children}
    </LanguageContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider')
  return ctx
}
