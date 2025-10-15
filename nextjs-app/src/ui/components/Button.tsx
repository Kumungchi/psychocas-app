'use client';

import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { colors, radii, spacing, typography, transitions, shadows } from '@/ui/theme';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
}

const baseStyle = {
  fontFamily: typography.body,
  borderRadius: radii.md,
  transition: transitions.default,
  fontWeight: 600,
  border: '1px solid transparent',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing.sm,
  boxShadow: shadows.sm,
};

const VARIANT_STYLES: Record<NonNullable<ButtonProps['variant']>, React.CSSProperties> = {
  primary: {
    backgroundColor: colors.brandPrimary,
    color: '#FFFFFF',
  },
  secondary: {
    backgroundColor: colors.brandSurface,
    color: colors.brandOnSurface,
    border: `1px solid ${colors.border}`,
    boxShadow: 'none',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
    boxShadow: 'none',
  },
  danger: {
    backgroundColor: colors.danger,
    color: '#FFFFFF',
  },
};

const SIZE_STYLES: Record<NonNullable<ButtonProps['size']>, React.CSSProperties> = {
  sm: {
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: '0.85rem',
  },
  md: {
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: '0.95rem',
  },
  lg: {
    padding: `${spacing.md} ${spacing.xl}`,
    fontSize: '1rem',
  },
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  style,
  ...props
}: PropsWithChildren<ButtonProps>) {
  const combinedClassName = [
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={combinedClassName}
      style={{
        ...baseStyle,
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        width: block ? '100%' : undefined,
        ...(props.disabled
          ? {
              cursor: 'not-allowed',
              opacity: 0.65,
              boxShadow: 'none',
            }
          : {
              cursor: 'pointer',
            }),
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
