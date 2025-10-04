'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface MemberData {
  membership_active: boolean;
  membership_expires: string | null;
  full_name: string | null;
  role: string;
  branch_id: string | null;
}

export default function Home() {
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchMemberData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push('/login');
          return;
        }

        setUser(user);

        const { data: member, error } = await supabase
          .from('members')
          .select('membership_active, membership_expires, full_name, role, branch_id')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching member data:', error);
          return;
        }

        setMemberData(member);
      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMemberData();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const formatExpiryDate = (dateStr: string | null) => {
    if (!dateStr) return 'Neuvedeno';
    return new Date(dateStr).toLocaleDateString('cs-CZ');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-brand-gray flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue mx-auto mb-4"></div>
          <p className="text-brand-text/70 font-avenir">Načítám...</p>
        </div>
      </main>
    );
  }

  if (!memberData) {
    return (
      <main className="min-h-screen bg-brand-gray flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-card shadow-soft p-6 text-center">
          <div className="text-brand-error text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-avenir-medium text-brand-text mb-2">
            Člen nenalezen
          </h2>
          <p className="text-brand-text/70 font-avenir mb-4">
            Tvůj účet není registrován jako člen spolku
          </p>
          <button
            onClick={handleSignOut}
            className="w-full bg-brand-error text-white py-3 px-4 rounded-button font-avenir-medium hover:bg-brand-error/90 transition-colors"
          >
            Odhlásit se
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-gray">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-sm mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-avenir-black text-brand-blue">Psychočas</h1>
            <p className="text-sm text-brand-text/70 font-avenir">
              {memberData.full_name || user?.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-brand-text/50 hover:text-brand-text font-avenir text-sm"
          >
            Odhlásit
          </button>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
        {/* Membership Status Card */}
        <div className="bg-white rounded-card shadow-soft p-6">
          <h2 className="text-xl font-avenir-medium text-brand-text mb-4">
            Stav členství
          </h2>
          
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-3 h-3 rounded-full ${
              memberData.membership_active ? 'bg-brand-success' : 'bg-brand-error'
            }`}></div>
            <span className={`font-avenir-medium ${
              memberData.membership_active ? 'text-brand-success' : 'text-brand-error'
            }`}>
              {memberData.membership_active ? 'Aktivní' : 'Neaktivní'}
            </span>
          </div>

          <div className="space-y-2 text-sm text-brand-text/70 font-avenir">
            <div className="flex justify-between">
              <span>Platnost do:</span>
              <span>{formatExpiryDate(memberData.membership_expires)}</span>
            </div>
            <div className="flex justify-between">
              <span>Role:</span>
              <span className="capitalize">{memberData.role}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {memberData.membership_active && (
            <button
              onClick={() => router.push('/redeem')}
              className="w-full bg-brand-blue text-white py-4 px-4 rounded-button font-avenir-medium hover:bg-brand-blue/90 transition-colors"
            >
              🎫 Uplatnit slevu
            </button>
          )}

          {(memberData.role === 'manager' || memberData.role === 'council') && (
            <button
              onClick={() => router.push('/validate')}
              className="w-full bg-brand-accent text-white py-4 px-4 rounded-button font-avenir-medium hover:bg-brand-accent/90 transition-colors"
            >
              ✅ Validovat kód
            </button>
          )}

          {(memberData.role === 'manager' || memberData.role === 'council') && (
            <button
              onClick={() => router.push('/stats')}
              className="w-full border border-brand-blue text-brand-blue py-4 px-4 rounded-button font-avenir-medium hover:bg-brand-blue/5 transition-colors"
            >
              📊 Statistiky
            </button>
          )}

          {memberData.role === 'technician' && (
            <button
              onClick={() => router.push('/technician')}
              className="w-full border border-brand-accent text-brand-accent py-4 px-4 rounded-button font-avenir-medium hover:bg-brand-accent/5 transition-colors"
            >
              🔧 Technická správa
            </button>
          )}
        </div>

        {/* Inactive Member Notice */}
        {!memberData.membership_active && (
          <div className="bg-brand-error/10 border border-brand-error/20 rounded-card p-4">
            <h3 className="font-avenir-medium text-brand-error mb-2">
              Neaktivní členství
            </h3>
            <p className="text-sm text-brand-error/80 font-avenir">
              Obnovte si členství pro přístup k funkcím aplikace
            </p>
          </div>
        )}
      </div>
    </main>
  );
}