'use client';

import { Languages } from 'lucide-react';
import useLocale from '@/hooks/useLocale';
import { supportedLocales, type Locale } from '@/lib/i18n/config';

const localeLabels: Record<Locale, string> = {
  cs: 'CZ',
  en: 'EN',
};

export default function LocaleToggle() {
  const { locale, setLocale, tr } = useLocale();

  return (
    <div
      className="locale-toggle"
      role="group"
      aria-label={tr('Jazyk aplikace')}
      data-testid="locale-switcher"
    >
      <Languages className="locale-toggle__icon" aria-hidden />
      {supportedLocales.map((option) => (
        <button
          key={option}
          type="button"
          className="locale-toggle__option"
          data-active={locale === option}
          aria-pressed={locale === option}
          aria-label={
            option === 'cs'
              ? tr('Přepnout aplikaci do češtiny')
              : tr('Přepnout aplikaci do angličtiny')
          }
          onClick={() => setLocale(option)}
        >
          {localeLabels[option]}
        </button>
      ))}
    </div>
  );
}
