'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface Member {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  membership_active: boolean;
  membership_expires: string | null;
  branch_id: string | null;
  created_at: string;
}

export default function Technician() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const router = useRouter();

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push('/login');
          return;
        }

        // Check if user is technician
        const { data: member } = await supabase
          .from('members')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (!member || member.role !== 'technician') {
          router.push('/home');
          return;
        }

        // Fetch all members
        let query = supabase
          .from('members')
          .select('*')
          .order('created_at', { ascending: false });

        if (filter === 'active') {
          query = query.eq('membership_active', true);
        } else if (filter === 'inactive') {
          query = query.eq('membership_active', false);
        }

        const { data: membersData, error: membersError } = await query;
        
        if (membersError) throw membersError;
        setMembers(membersData || []);

      } catch (error) {
        console.error('Error fetching members:', error);
        setError(error instanceof Error ? error.message : 'Nastala neočekávaná chyba');
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [filter, router]);

  const updateMemberStatus = async (userId: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('members')
        .update({ membership_active: active })
        .eq('user_id', userId);

      if (error) throw error;

      // Update local state
      setMembers(members.map(member => 
        member.user_id === userId 
          ? { ...member, membership_active: active }
          : member
      ));
    } catch (error) {
      console.error('Error updating member status:', error);
      setError('Nepodařilo se aktualizovat stav člena');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Neuvedeno';
    return new Date(dateStr).toLocaleDateString('cs-CZ');
  };

  const getActiveCount = () => members.filter(m => m.membership_active).length;
  const getInactiveCount = () => members.filter(m => m.membership_active === false).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-brand-gray flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue mx-auto mb-4"></div>
          <p className="text-brand-text/70 font-avenir">Načítám členy...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-gray">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-sm mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-brand-blue hover:text-brand-blue/80"
          >
            ← Zpět
          </button>
          <h1 className="text-lg font-avenir-black text-brand-blue">
            Technická správa
          </h1>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-card shadow-soft p-4 text-center">
            <div className="text-xl font-avenir-black text-brand-blue mb-1">
              {members.length}
            </div>
            <p className="text-xs text-brand-text/70 font-avenir">
              Celkem
            </p>
          </div>
          <div className="bg-white rounded-card shadow-soft p-4 text-center">
            <div className="text-xl font-avenir-black text-brand-success mb-1">
              {getActiveCount()}
            </div>
            <p className="text-xs text-brand-text/70 font-avenir">
              Aktivní
            </p>
          </div>
          <div className="bg-white rounded-card shadow-soft p-4 text-center">
            <div className="text-xl font-avenir-black text-brand-error mb-1">
              {getInactiveCount()}
            </div>
            <p className="text-xs text-brand-text/70 font-avenir">
              Neaktivní
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-card shadow-soft p-4">
          <h3 className="text-sm font-avenir-medium text-brand-text mb-3">
            Filtrovat členy
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-2 px-3 rounded-lg font-avenir text-xs transition-colors ${
                filter === 'all'
                  ? 'bg-brand-blue text-white'
                  : 'bg-brand-gray text-brand-text hover:bg-brand-gray/80'
              }`}
            >
              Všichni
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`flex-1 py-2 px-3 rounded-lg font-avenir text-xs transition-colors ${
                filter === 'active'
                  ? 'bg-brand-success text-white'
                  : 'bg-brand-gray text-brand-text hover:bg-brand-gray/80'
              }`}
            >
              Aktivní
            </button>
            <button
              onClick={() => setFilter('inactive')}
              className={`flex-1 py-2 px-3 rounded-lg font-avenir text-xs transition-colors ${
                filter === 'inactive'
                  ? 'bg-brand-error text-white'
                  : 'bg-brand-gray text-brand-text hover:bg-brand-gray/80'
              }`}
            >
              Neaktivní
            </button>
          </div>
        </div>

        {/* Members List */}
        <div className="space-y-3">
          {members.length > 0 ? (
            members.map((member) => (
              <div key={member.user_id} className="bg-white rounded-card shadow-soft p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="font-avenir-medium text-brand-text">
                      {member.full_name || 'Bez jména'}
                    </h4>
                    <p className="text-sm text-brand-text/70 font-avenir">
                      {member.email}
                    </p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${
                    member.membership_active ? 'bg-brand-success' : 'bg-brand-error'
                  }`}></div>
                </div>

                <div className="space-y-1 text-xs text-brand-text/70 font-avenir mb-3">
                  <div className="flex justify-between">
                    <span>Role:</span>
                    <span className="capitalize">{member.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platnost:</span>
                    <span>{formatDate(member.membership_expires)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Registrace:</span>
                    <span>{formatDate(member.created_at)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {!member.membership_active ? (
                    <button
                      onClick={() => updateMemberStatus(member.user_id, true)}
                      className="flex-1 bg-brand-success text-white py-2 px-3 rounded-lg font-avenir text-xs hover:bg-brand-success/90 transition-colors"
                    >
                      Aktivovat
                    </button>
                  ) : (
                    <button
                      onClick={() => updateMemberStatus(member.user_id, false)}
                      className="flex-1 bg-brand-error text-white py-2 px-3 rounded-lg font-avenir text-xs hover:bg-brand-error/90 transition-colors"
                    >
                      Deaktivovat
                    </button>
                  )}
                  <button
                    onClick={() => router.push('/stats')}
                    className="border border-brand-blue text-brand-blue py-2 px-3 rounded-lg font-avenir text-xs hover:bg-brand-blue/5 transition-colors"
                  >
                    Statistiky
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-card shadow-soft p-6 text-center">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-brand-text/70 font-avenir">
                Žádní členové podle filtru
              </p>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-brand-error/10 border border-brand-error/20 rounded-card p-4">
            <h4 className="font-avenir-medium text-brand-error mb-2">
              Chyba
            </h4>
            <p className="text-sm text-brand-error/80 font-avenir">{error}</p>
          </div>
        )}

        {/* Health Check Link */}
        <div className="text-center">
          <button
            onClick={() => router.push('/test')}
            className="text-brand-blue hover:text-brand-blue/80 font-avenir text-sm"
          >
            🩺 Health Check →
          </button>
        </div>
      </div>
    </main>
  );
}