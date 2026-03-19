import { Button } from './ui/button';
import { Home, QrCode, BarChart3, Settings, LogOut } from 'lucide-react';

interface NavigationProps {
  currentScreen: string;
  userRole: 'member' | 'manager' | 'admin';
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export function Navigation({ currentScreen, userRole, onNavigate, onLogout }: NavigationProps) {
  const menuItems = [
    { id: 'home', label: 'Domů', icon: Home, roles: ['member', 'manager', 'admin'] },
    { id: 'validation', label: 'Ověření', icon: QrCode, roles: ['manager', 'admin'] },
    { id: 'statistics', label: 'Statistiky', icon: BarChart3, roles: ['manager', 'admin'] },
    { id: 'technician', label: 'Správa', icon: Settings, roles: ['admin'] }
  ];

  const visibleItems = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-2 max-w-md mx-auto" style={{ borderColor: '#e0e0e0', boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)' }}>
      <div className="flex items-center justify-around">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex flex-col items-center gap-1 p-3 transition-colors duration-200"
            >
              <Icon 
                className="w-5 h-5" 
                style={{ color: isActive ? '#1d4f7d' : '#666666' }}
              />
              <span 
                className="text-xs"
                style={{ color: isActive ? '#1d4f7d' : '#666666' }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
        
        <button
          onClick={onLogout}
          className="flex flex-col items-center gap-1 p-3 transition-colors duration-200"
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