import type { CSSProperties, PropsWithChildren } from 'react';
import clsx from 'clsx';
import { colors, radii, spacing, typography } from '@/ui/theme';

export interface BadgeProps {
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  className?: string;
  style?: CSSProperties;
}

const toneStyles: Record<NonNullable<BadgeProps['tone']>, { background: string; color: string; border?: string }> = {
  info: {
    background: 'rgba(37, 99, 235, 0.12)',
    color: colors.infoStrong,
    border: '1px solid rgba(37, 99, 235, 0.18)',
  },
  success: {
    background: 'rgba(34, 197, 94, 0.12)',
    color: colors.success,
    border: '1px solid rgba(34, 197, 94, 0.18)',
  },
  warning: {
    background: 'rgba(245, 158, 11, 0.12)',
    color: colors.warning,
    border: '1px solid rgba(245, 158, 11, 0.18)',
  },
  danger: {
    background: 'rgba(220, 38, 38, 0.12)',
    color: colors.danger,
    border: '1px solid rgba(220, 38, 38, 0.18)',
  },
  neutral: {
    background: 'rgba(148, 163, 184, 0.12)',
    color: colors.textSecondary,
    border: '1px solid rgba(148, 163, 184, 0.18)',
  },
};

export default function Badge({ tone = 'neutral', className, style, children }: PropsWithChildren<BadgeProps>) {
  return (
    <span
      className={clsx('badge-pill', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${spacing.xs} calc(${spacing.sm} * 1.5)`,
        borderRadius: radii.full,
        fontFamily: typography.body,
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        boxShadow: '0 8px 22px -18px rgba(15, 23, 42, 0.45)',
        ...toneStyles[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
