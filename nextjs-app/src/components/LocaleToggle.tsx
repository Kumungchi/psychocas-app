'use client';

import useLocale from '@/hooks/useLocale';
import { type Locale } from '@/lib/i18n/config';

type LocaleToggleConfig = {
  ariaLabel: string;
  icon: string;
  label: string;
  next: Locale;
  title: string;
};

const LOCALE_CONFIG: Record<Locale, LocaleToggleConfig> = {
  cs: {
    ariaLabel: 'Přepnout aplikaci do angličtiny',
    icon: '🇨🇿',
    label: 'CZ',
    next: 'en',
    title: 'Čeština',
  },
  en: {
    ariaLabel: 'Switch the app to Czech',
    icon: '🇬🇧',
    label: 'EN',
    next: 'cs',
    title: 'English',
  },
};

export default function LocaleToggle() {
  const { locale, setLocale } = useLocale();
  const activeLocale = LOCALE_CONFIG[locale];

  const handleToggle = () => {
    setLocale(activeLocale.next);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={activeLocale.ariaLabel}
      className="locale-toggle"
      data-locale={locale}
      title={activeLocale.title}
    >
      <span className="locale-toggle__label" aria-hidden>
        <span className="locale-toggle__icon" aria-hidden="true" role="presentation">
          {activeLocale.icon}
        </span>
        <span className="locale-toggle__text">{activeLocale.label}</span>
      </span>
      <span className="sr-only">{activeLocale.ariaLabel}</span>
    </button>
  );
}
