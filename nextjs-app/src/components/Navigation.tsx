'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Home, QrCode, BarChart3, Settings, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { colors, radii, spacing, typography } from '@/ui/theme';
import useLocale from '@/hooks/useLocale';

interface NavigationProps {
  userRole: 'member' | 'manager' | 'council' | 'technician';
}

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: colors.background,
  borderTop: `1px solid ${colors.border}`,
  padding: `${spacing.sm} ${spacing.lg}`,
  maxWidth: '480px',
  margin: '0 auto',
  zIndex: 50,
  boxShadow: '0 -6px 24px rgba(15, 23, 42, 0.08)',
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: spacing.xs,
  padding: spacing.sm,
  borderRadius: radii.md,
  transition: 'all 0.2s ease-in-out',
  fontFamily: typography.body,
};

export default function Navigation({ userRole }: NavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLocale();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const menuItems = [
    { id: '/home', label: t('navigation.home'), icon: Home, roles: ['member', 'manager', 'council', 'technician'] as const },
    { id: '/validate', label: t('navigation.validate'), icon: QrCode, roles: ['manager', 'council'] as const },
    { id: '/stats', label: t('navigation.stats'), icon: BarChart3, roles: ['manager', 'council'] as const },
    { id: '/technician', label: t('navigation.technician'), icon: Settings, roles: ['technician', 'council'] as const },
  ];

  const visibleItems = menuItems.filter((item) => item.roles.includes(userRole as never));

  return (
    <nav style={containerStyle} aria-label={t('navigation.mainNav')}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: spacing.sm }}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.id;

          return (
            <button
              key={item.id}
              onClick={() => router.push(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              style={{
                ...itemStyle,
                color: isActive ? colors.brandPrimary : colors.textSecondary,
                backgroundColor: isActive ? colors.brandSurface : 'transparent',
              }}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.9} />
              <span style={{ fontSize: '0.75rem', fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
            </button>
          );
        })}

        <button
          onClick={handleLogout}
          aria-label={t('navigation.logout')}
          style={{
            ...itemStyle,
            color: colors.danger,
            backgroundColor: 'transparent',
            boxShadow: 'none',
          }}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <LogOut size={20} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('navigation.logout')}</span>
        </button>
      </div>
    </nav>
  );
}
