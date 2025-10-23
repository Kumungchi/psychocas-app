'use client';

import type { ButtonHTMLAttributes, PropsWithChildren, CSSProperties } from 'react';
import clsx from 'clsx';
import { colors, radii, spacing, typography, transitions, shadows } from '@/ui/theme';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
}

const baseStyle: CSSProperties = {
  fontFamily: typography.body,
  transition: transitions.default,
  fontWeight: 600,
  border: '1px solid transparent',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing.sm,
  borderRadius: radii.full,
};

const baseClassName =
  'relative inline-flex items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60';

const VARIANT_STYLES: Record<NonNullable<ButtonProps['variant']>, CSSProperties> = {
  primary: {
    backgroundImage: 'linear-gradient(135deg, #1d4f7d 0%, #049edb 100%)',
    color: '#FFFFFF',
    boxShadow: shadows.md,
  },
  secondary: {
    backgroundColor: 'rgba(29, 79, 125, 0.08)',
    border: '1px solid rgba(29, 79, 125, 0.18)',
    color: colors.brandPrimary,
    boxShadow: shadows.sm,
  },
  ghost: {
    backgroundColor: 'transparent',
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
    boxShadow: 'none',
  },
  danger: {
    backgroundImage: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
    color: '#FFFFFF',
    boxShadow: shadows.md,
  },
};

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'hover:-translate-y-0.5 hover:shadow-xl focus-visible:ring-sky-200 active:translate-y-0',
  secondary:
    'hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-sky-100 active:translate-y-0 bg-white/70 backdrop-blur-sm',
  ghost: 'hover:bg-slate-50 focus-visible:ring-slate-200 active:translate-y-0',
  danger: 'hover:-translate-y-0.5 hover:shadow-2xl focus-visible:ring-rose-200 active:translate-y-0',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-base',
  lg: 'h-12 px-7 text-lg',
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
  return (
    <button
      className={clsx(
        baseClassName,
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        block && 'w-full',
        className,
      )}
      style={{
        ...baseStyle,
        ...VARIANT_STYLES[variant],
        ...(props.disabled
          ? {
              cursor: 'not-allowed',
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
