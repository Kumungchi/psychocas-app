'use client';

import { useRouter, usePathname } from 'next/navigation';
import { CalendarDays, Home, QrCode, BarChart3, Settings, LogOut, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import clsx from 'clsx';
import { supabase } from '@/lib/supabaseClient';
import { colors, radii, spacing, typography } from '@/ui/theme';
import useLocale from '@/hooks/useLocale';
import type { MemberRole } from '@/types/member';

interface NavigationProps {
  userRole: MemberRole;
}

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  roles: MemberRole[];
}

const containerStyle: CSSProperties = {
  position: 'fixed',
  bottom: 'clamp(1rem, 3vw, 1.75rem)',
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: 'rgba(255, 255, 255, 0.92)',
  border: `1px solid ${colors.border}`,
  padding: '0.65rem 1.5rem',
  maxWidth: '480px',
  width: 'min(100%, 480px)',
  zIndex: 50,
  borderRadius: '28px',
  boxShadow: '0 32px 70px -38px rgba(15, 23, 42, 0.45)',
  backdropFilter: 'blur(18px)',
};

const itemStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: spacing.xs,
  padding: `${spacing.xs} ${spacing.sm}`,
  borderRadius: radii.lg,
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

  const menuItems: MenuItem[] = [
    { id: '/home', label: t('navigation.home'), icon: Home, roles: ['member', 'manager', 'council', 'technician', 'admin'] },
    { id: '/events', label: t('navigation.events'), icon: CalendarDays, roles: ['member', 'manager', 'council', 'technician', 'admin'] },
    { id: '/validate', label: t('navigation.validate'), icon: QrCode, roles: ['manager', 'council', 'admin'] },
    { id: '/stats', label: t('navigation.stats'), icon: BarChart3, roles: ['manager', 'council', 'admin'] },
    { id: '/technician', label: t('navigation.technician'), icon: Settings, roles: ['technician', 'council', 'admin'] },
  ];

  const visibleItems = menuItems.filter((item) => item.roles.includes(userRole));

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
                backgroundColor: isActive ? 'rgba(231, 240, 255, 0.9)' : 'transparent',
                boxShadow: isActive ? '0 18px 32px -20px rgba(30, 64, 175, 0.45)' : 'none',
              }}
              className={clsx(
                'flex flex-col items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-200',
                isActive
                  ? 'text-sky-800'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/70 hover:-translate-y-0.5',
              )}
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
          className="flex flex-col items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-500 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-200 hover:-translate-y-0.5"
        >
          <LogOut size={20} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('navigation.logout')}</span>
        </button>
      </div>
    </nav>
  );
}
