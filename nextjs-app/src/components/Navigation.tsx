'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Home, QrCode, BarChart3, Settings, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import PsychocasLogo from './PsychocasLogo';

interface NavigationProps {
  userRole: 'member' | 'manager' | 'council' | 'technician';
}

export default function Navigation({ userRole }: NavigationProps) {
  const router = useRouter();
  const pathname = usePathname()

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const menuItems = [
    { id: '/home', label: 'Domů', icon: Home, roles: ['member', 'manager', 'council', 'technician'] },
    { id: '/validate', label: 'Ověření', icon: QrCode, roles: ['manager', 'council'] },
    { id: '/stats', label: 'Statistiky', icon: BarChart3, roles: ['manager', 'council'] },
    { id: '/technician', label: 'Správa', icon: Settings, roles: ['technician', 'council'] }
  ];

  const visibleItems = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-2 max-w-md mx-auto z-50" style={{ borderColor: '#e0e0e0', boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)' }}>
      <div className="flex items-center justify-around">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.id)}
              className="flex flex-col items-center gap-1 p-3 transition-colors duration-200 hover:opacity-80"
            >
              <Icon 
                className="w-5 h-5" 
                style={{ color: isActive ? '#1d4f7d' : '#666666' }}
              />
              <span 
                className="text-xs"
                style={{ color: isActive ? '#1d4f7d' : '#666666', fontWeight: isActive ? '600' : '400' }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
        
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 p-3 transition-colors duration-200 hover:opacity-80"
        >
          <LogOut 
            className="w-5 h-5" 
            style={{ color: '#c62828' }}
          />
          <span 
            className="text-xs"
            style={{ color: '#c62828' }}
          >
            Odhlásit
          </span>
        </button>
      </div>
    </div>
  );
}