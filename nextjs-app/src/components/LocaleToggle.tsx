'use client';

import useLocale from '@/hooks/useLocale';

export default function LocaleToggle() {
  const { locale, setLocale } = useLocale();

  const handleToggle = () => {
    setLocale(locale === 'cs' ? 'en' : 'cs');
  };

  const ariaLabel =
    locale === 'cs'
      ? 'Přepnout aplikaci do angličtiny'
      : 'Switch the app to Czech';

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={ariaLabel}
      className="locale-toggle"
    >
      <span className="locale-toggle__label" aria-hidden>
        <span className="locale-toggle__dot" />
        {locale === 'cs' ? 'CZ' : 'EN'}
      </span>
      <span className="sr-only">{ariaLabel}</span>
    </button>
  );
}
