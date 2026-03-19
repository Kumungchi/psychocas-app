import type { CSSProperties, PropsWithChildren, ReactNode } from 'react';
import clsx from 'clsx';
import { colors, radii, shadows, spacing, typography } from '@/ui/theme';

export interface CardProps {
  title?: string;
  subtitle?: string;
  headerSlot?: ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: CSSProperties;
}

export default function Card({
  title,
  subtitle,
  headerSlot,
  padding = 'md',
  className,
  style,
  children,
}: PropsWithChildren<CardProps>) {
  const paddingMap: Record<NonNullable<CardProps['padding']>, string> = {
    sm: '1.5rem',
    md: '2.1rem',
    lg: '2.6rem',
  };

  return (
    <section
      className={clsx('card-surface', className)}
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(244,248,255,0.98) 100%)',
        borderRadius: `calc(${radii.lg} * 1.15)`,
        boxShadow: shadows.md,
        padding: paddingMap[padding],
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        border: `1px solid ${colors.border}`,
        backdropFilter: 'blur(18px)',
        ...style,
      }}
    >
      {(title || subtitle || headerSlot) && (
        <header
          style={{
            display: 'flex',
            alignItems: subtitle ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ flex: 1 }}>
            {title && (
              <h2
                style={{
                  margin: 0,
                  fontFamily: typography.heading,
                  fontSize: '1.15rem',
                  color: colors.textPrimary,
                }}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                style={{
                  marginTop: spacing.xs,
                  fontFamily: typography.body,
                  fontSize: '0.95rem',
                  color: colors.textSecondary,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {headerSlot}
        </header>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{children}</div>
    </section>
  );
}
