import type { PropsWithChildren, ReactNode } from 'react';
import { colors, radii, spacing, shadows, typography } from '@/ui/theme';

export interface CardProps {
  title?: string;
  subtitle?: string;
  headerSlot?: ReactNode;
  padding?: 'sm' | 'md' | 'lg';
}

export default function Card({
  title,
  subtitle,
  headerSlot,
  padding = 'md',
  children,
}: PropsWithChildren<CardProps>) {
  return (
    <section
      style={{
        backgroundColor: colors.background,
        borderRadius: radii.lg,
        boxShadow: shadows.sm,
        padding: padding === 'sm' ? spacing.sm : padding === 'md' ? spacing.lg : spacing.xl,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.md,
      }}
    >
      {(title || subtitle || headerSlot) && (
        <header
          style={{
            display: 'flex',
            alignItems: subtitle ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: spacing.md,
          }}
        >
          <div style={{ flex: 1 }}>
            {title && (
              <h2
                style={{
                  margin: 0,
                  fontFamily: typography.heading,
                  fontSize: '1.1rem',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>{children}</div>
    </section>
  );
}
