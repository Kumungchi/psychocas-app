'use client';

import useLocale from '@/hooks/useLocale';
import { colors, radii, spacing, typography } from '@/ui/theme';

export default function LocaleToggle() {
  const { locale, setLocale } = useLocale();

  const handleToggle = () => {
    setLocale(locale === 'cs' ? 'en' : 'cs');
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      style={{
        position: 'fixed',
        top: spacing.lg,
        right: spacing.lg,
        backgroundColor: colors.brandSurface,
        color: colors.brandOnSurface,
        borderRadius: radii.full,
        padding: `${spacing.xs} ${spacing.md}`,
        fontFamily: typography.body,
        fontSize: '0.8rem',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
      }}
    >
      {locale === 'cs' ? 'CZ' : 'EN'}
    </button>
  );
}
