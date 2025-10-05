'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Navigation from '@/components/Navigation';

interface MemberData {
  membership_active: boolean;
  membership_expires: string | null;
  full_name: string | null;
  role: string;
  branch_id: string | null;
}

function HomeContent() {
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for error parameter from middleware redirect
    const errorParam = searchParams.get('error');
    if (errorParam === 'unauthorized') {
      setError('Nemáte oprávnění k přístupu na tuto stránku.');
      // Clear error from URL after 5 seconds
      setTimeout(() => {
        router.replace('/home');
      }, 5000);
    }
  }, [searchParams, router]);

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
      <main className="psychocas-section flex items-center justify-center">
        <div className="text-center fade-in-up">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: '#1d4f7d' }}></div>
          <p style={{ color: '#666666' }}>Načítám...</p>
        </div>
      </main>
    );
  }

  if (!memberData) {
    return (
      <main className="psychocas-section flex items-center justify-center">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card text-center">
            <div className="text-4xl mb-4" style={{ color: '#c62828' }}>⚠️</div>
            <h2 className="mb-2">
              Člen nenalezen
            </h2>
            <p className="mb-6" style={{ color: '#666666' }}>
              Tvůj účet není registrován jako člen spolku
            </p>
            <button
              onClick={handleSignOut}
              className="psychocas-button-primary"
              style={{ backgroundColor: '#c62828' }}
            >
              Odhlásit se
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="psychocas-section pb-20">
      <div className="psychocas-container space-y-8 fade-in-up">
        {/* Error Message */}
        {error && (
          <div className="psychocas-card" style={{ 
            backgroundColor: '#fef2f2', 
            borderLeft: '4px solid #c62828',
            animation: 'fade-in-up 0.5s ease-out'
          }}>
            <div className="flex items-center gap-3">
              <div className="text-2xl">⚠️</div>
              <p style={{ color: '#c62828', fontWeight: '500' }}>{error}</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center pt-6">
          <h1 className="mb-3">
            Vítejte zpět!
          </h1>
          <p style={{ color: '#666666', fontSize: '1rem' }}>
            {memberData.full_name || user?.email}
          </p>
        </div>

        {/* Membership Status Card */}
        <div className="psychocas-card">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 style={{ color: '#333333' }}>Stav členství</h2>
              <div 
                className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                  memberData.membership_active ? 'status-active' : 'status-inactive'
                }`}
              >
                {memberData.membership_active ? '✓ Aktivní' : '✗ Neaktivní'}
              </div>
            </div>
            
            <div className="space-y-3">
              <p style={{ color: '#666666', fontSize: '0.95rem' }}>
                Platnost do
              </p>
              <p style={{ color: '#333333', fontSize: '1.1rem', fontWeight: '500' }}>
                {formatExpiryDate(memberData.membership_expires)}
              </p>
            </div>

            {memberData.membership_active && (
              <button
                onClick={() => router.push('/redeem')}
                className="psychocas-button-primary mt-6"
              >
                Uplatnit slevu
              </button>
            )}
          </div>
        </div>

        {/* App Info */}
        <div className="psychocas-card">
          <h3 className="mb-4" style={{ color: '#333333' }}>
            O aplikaci Psychočas
          </h3>
          <div className="space-y-3" style={{ color: '#666666', fontSize: '0.95rem' }}>
            <p>
              Vaše digitální členská karta pro rychlé a pohodlné uplatňování slev ve spolupracujících podnicích.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#f8f9fa' }}>
                <div style={{ color: '#1d4f7d', fontWeight: '600' }}>3 min</div>
                <div className="text-xs">Platnost kódu</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#f8f9fa' }}>
                <div style={{ color: '#1d4f7d', fontWeight: '600' }}>24/7</div>
                <div className="text-xs">Dostupnost</div>
              </div>
            </div>
          </div>
        </div>

        {/* Manager/Admin Actions */}
        {(memberData.role === 'manager' || memberData.role === 'council' || memberData.role === 'technician') && (
          <div className="psychocas-card">
            <h3 className="mb-6" style={{ color: '#333333' }}>
              Správa
            </h3>
            <div className="space-y-3">
              {(memberData.role === 'manager' || memberData.role === 'council') && (
                <>
                  <button
                    onClick={() => router.push('/validate')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all duration-300"
                    style={{ border: '1px solid #e0e0e0' }}
                  >
                    <span className="text-xl">✅</span>
                    <span style={{ color: '#333333', fontSize: '1rem' }}>Validovat kód</span>
                  </button>
                  <button
                    onClick={() => router.push('/stats')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all duration-300"
                    style={{ border: '1px solid #e0e0e0' }}
                  >
                    <span className="text-xl">📊</span>
                    <span style={{ color: '#333333', fontSize: '1rem' }}>Statistiky</span>
                  </button>
                </>
              )}
              {memberData.role === 'technician' && (
                <button
                  onClick={() => router.push('/technician')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all duration-300"
                  style={{ border: '1px solid #e0e0e0' }}
                >
                  <span className="text-xl">🔧</span>
                  <span style={{ color: '#333333', fontSize: '1rem' }}>Technická správa</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Inactive Member Notice */}
        {!memberData.membership_active && (
          <div className="psychocas-card status-inactive">
            <h3 className="mb-2">
              Neaktivní členství
            </h3>
            <p className="text-sm">
              Obnovte si členství pro přístup k funkcím aplikace
            </p>
          </div>
        )}

      </div>

      {/* Navigation Bar */}
      {memberData && <Navigation userRole={memberData.role as 'member' | 'manager' | 'council' | 'technician'} />}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="psychocas-section flex items-center justify-center">
        <div className="text-center fade-in-up">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: '#1d4f7d' }}></div>
          <p style={{ color: '#666666' }}>Načítám...</p>
        </div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  );
}