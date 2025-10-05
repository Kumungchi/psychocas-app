'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Users, CheckCircle, XCircle, Search } from 'lucide-react';
import Navigation from '@/components/Navigation';

interface Member {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  membership_active: boolean;
  membership_expires: string | null;
}

const mockMembers: Member[] = [
  {
    user_id: '1',
    email: 'bunnik.matias@seznam.cz',
    full_name: 'Matias Bunnik',
    role: 'member',
    membership_active: true,
    membership_expires: '2025-12-31'
  },
  {
    user_id: '2',
    email: 'viceprezident@psychočas.cz',
    full_name: 'Viceprezident',
    role: 'council',
    membership_active: true,
    membership_expires: '2025-12-31'
  }
];

export default function Technician() {
  const [members, setMembers] = useState<Member[]>(mockMembers);
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<'member' | 'manager' | 'council' | 'technician'>('technician');

  // Fetch user role on mount
  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: member } = await supabase
          .from('members')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (member) {
          setUserRole(member.role as 'member' | 'manager' | 'council' | 'technician');
        }
      }
    };

    fetchUserRole();
  }, []);

  const filteredMembers = members.filter(member =>
    member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (member.full_name && member.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'council': return 'Rada';
      case 'manager': return 'Manažer';
      case 'technician': return 'Technik';
      default: return 'Člen';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'council': return { bg: '#ffebee', color: '#c62828' };
      case 'manager': return { bg: '#e1f5fe', color: '#049edb' };
      case 'technician': return { bg: '#fff3e0', color: '#ff9800' };
      default: return { bg: '#e8f5e8', color: '#2e7d32' };
    }
  };

  return (
    <main className="psychocas-section pb-20">
      <div className="psychocas-container space-y-6 fade-in-up">
        {/* Header */}
        <div className="text-center pt-6">
          <h1 className="mb-3">Správa členů</h1>
          <p style={{ color: '#666666' }}>Přehled všech členů spolku</p>
        </div>

        {/* Search */}
        <div className="psychocas-card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: '#666666' }} />
            <input
              placeholder="Hledat podle emailu nebo jména..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="psychocas-input pl-10"
            />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="psychocas-card text-center">
            <Users className="w-8 h-8 mx-auto mb-2" style={{ color: '#1d4f7d' }} />
            <div className="text-2xl font-bold mb-1" style={{ color: '#333333' }}>
              {members.length}
            </div>
            <p className="text-sm" style={{ color: '#666666' }}>Celkem</p>
          </div>
          
          <div className="psychocas-card text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: '#2e7d32' }} />
            <div className="text-2xl font-bold mb-1" style={{ color: '#333333' }}>
              {members.filter(m => m.membership_active).length}
            </div>
            <p className="text-sm" style={{ color: '#666666' }}>Aktivních</p>
          </div>
          
          <div className="psychocas-card text-center">
            <XCircle className="w-8 h-8 mx-auto mb-2" style={{ color: '#c62828' }} />
            <div className="text-2xl font-bold mb-1" style={{ color: '#333333' }}>
              {members.filter(m => !m.membership_active).length}
            </div>
            <p className="text-sm" style={{ color: '#666666' }}>Neaktivních</p>
          </div>
        </div>

        {/* Members List */}
        <div className="psychocas-card">
          <h3 className="mb-4 pb-3 border-b" style={{ color: '#333333', borderColor: '#e0e0e0' }}>
            Seznam členů ({filteredMembers.length})
          </h3>
          
          <div className="space-y-3">
            {filteredMembers.map((member) => (
              <div 
                key={member.user_id} 
                className="p-4 rounded-xl border hover:shadow-md transition-shadow"
                style={{ borderColor: '#e0e0e0', backgroundColor: '#fafafa' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium" style={{ color: '#333333' }}>
                        {member.full_name || member.email}
                      </h4>
                      <span 
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={getRoleColor(member.role)}
                      >
                        {getRoleLabel(member.role)}
                      </span>
                      <span 
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: member.membership_active ? '#e8f5e8' : '#ffebee',
                          color: member.membership_active ? '#2e7d32' : '#c62828'
                        }}
                      >
                        {member.membership_active ? 'Aktivní' : 'Neaktivní'}
                      </span>
                    </div>
                    
                    <p className="text-sm mb-1" style={{ color: '#666666' }}>
                      📧 {member.email}
                    </p>
                    
                    {member.membership_expires && (
                      <p className="text-sm" style={{ color: '#666666' }}>
                        📅 Platnost do: {new Date(member.membership_expires).toLocaleDateString('cs-CZ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredMembers.length === 0 && (
            <div className="text-center py-8">
              <p style={{ color: '#666666' }}>Žádní členové nenalezeni</p>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="psychocas-card" style={{ backgroundColor: '#e3f2fd' }}>
          <h4 className="mb-2" style={{ color: '#1d4f7d' }}>
            ℹ️ Informace
          </h4>
          <ul className="space-y-1 text-sm" style={{ color: '#1d4f7d' }}>
            <li>• Pro úpravu členů použijte Supabase Dashboard</li>
            <li>• Tato stránka slouží pro přehled a vyhledávání</li>
            <li>• Mock data pro demonstraci funkcionality</li>
          </ul>
        </div>
      </div>

      {/* Navigation Bar */}
      <Navigation userRole={userRole} />
    </main>
  );
}
