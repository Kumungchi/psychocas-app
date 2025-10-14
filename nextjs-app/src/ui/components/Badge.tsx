import type { PropsWithChildren } from 'react';
import { colors, radii, spacing, typography } from '@/ui/theme';

export interface BadgeProps {
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
}

const toneStyles: Record<NonNullable<BadgeProps['tone']>, { background: string; color: string }> = {
  info: {
    background: colors.brandSurface,
    color: colors.brandOnSurface,
  },
  success: {
    background: colors.accentMuted,
    color: colors.accent,
  },
  warning: {
    background: '#FEF3C7',
    color: colors.warning,
  },
  danger: {
    background: '#FEE2E2',
    color: colors.danger,
  },
  neutral: {
    background: colors.backgroundMuted,
    color: colors.textSecondary,
  },
};

export default function Badge({ tone = 'neutral', children }: PropsWithChildren<BadgeProps>) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${spacing.xs} ${spacing.sm}`,
        borderRadius: radii.full,
        fontFamily: typography.body,
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        ...toneStyles[tone],
      }}
    >
      {children}
    </span>
  );
}
