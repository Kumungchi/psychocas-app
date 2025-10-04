'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface DailyStats {
  day: string;
  total: number;
}

interface BranchData {
  id: string;
  name: string;
  city: string | null;
}

export default function Stats() {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week');
  const router = useRouter();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push('/login');
          return;
        }

        // Fetch user role
        const { data: member } = await supabase
          .from('members')
          .select('role, branch_id')
          .eq('user_id', user.id)
          .single();

        if (!member || !['manager', 'council'].includes(member.role)) {
          router.push('/home');
          return;
        }

        // Fetch branches
        const { data: branchData, error: branchError } = await supabase
          .from('branches')
          .select('id, name, city')
          .order('name');

        if (branchError) throw branchError;
        setBranches(branchData || []);

        // Fetch daily stats
        const daysBack = selectedPeriod === 'week' ? 7 : 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        let query = supabase
          .from('redemptions_daily')
          .select('*')
          .gte('day', startDate.toISOString().split('T')[0])
          .order('day', { ascending: true });

        // If user is manager, filter by their branch
        if (member.role === 'manager' && member.branch_id) {
          query = query.eq('branch_id', member.branch_id);
        }

        const { data: statsData, error: statsError } = await query;
        
        if (statsError) throw statsError;
        setDailyStats(statsData || []);

      } catch (error) {
        console.error('Error fetching stats:', error);
        setError(error instanceof Error ? error.message : 'Nastala neočekávaná chyba');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [selectedPeriod, router]);

  const getTotalRedemptions = () => {
    return dailyStats.reduce((sum, stat) => sum + stat.total, 0);
  };

  const getAverageDaily = () => {
    if (dailyStats.length === 0) return 0;
    return Math.round(getTotalRedemptions() / dailyStats.length * 10) / 10;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('cs-CZ', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-brand-gray flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue mx-auto mb-4"></div>
          <p className="text-brand-text/70 font-avenir">Načítám statistiky...</p>
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
            Statistiky
          </h1>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
        {/* Period Selector */}
        <div className="bg-white rounded-card shadow-soft p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedPeriod('week')}
              className={`flex-1 py-2 px-4 rounded-lg font-avenir text-sm transition-colors ${
                selectedPeriod === 'week'
                  ? 'bg-brand-blue text-white'
                  : 'bg-brand-gray text-brand-text hover:bg-brand-gray/80'
              }`}
            >
              Týden
            </button>
            <button
              onClick={() => setSelectedPeriod('month')}
              className={`flex-1 py-2 px-4 rounded-lg font-avenir text-sm transition-colors ${
                selectedPeriod === 'month'
                  ? 'bg-brand-blue text-white'
                  : 'bg-brand-gray text-brand-text hover:bg-brand-gray/80'
              }`}
            >
              Měsíc
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-card shadow-soft p-4 text-center">
            <div className="text-2xl font-avenir-black text-brand-blue mb-1">
              {getTotalRedemptions()}
            </div>
            <p className="text-sm text-brand-text/70 font-avenir">
              Celkem uplatnění
            </p>
          </div>
          <div className="bg-white rounded-card shadow-soft p-4 text-center">
            <div className="text-2xl font-avenir-black text-brand-accent mb-1">
              {getAverageDaily()}
            </div>
            <p className="text-sm text-brand-text/70 font-avenir">
              Průměr/den
            </p>
          </div>
        </div>

        {/* Daily Chart */}
        <div className="bg-white rounded-card shadow-soft p-6">
          <h3 className="text-lg font-avenir-medium text-brand-text mb-4">
            Denní přehled
          </h3>
          
          {dailyStats.length > 0 ? (
            <div className="space-y-3">
              {dailyStats.map((stat) => (
                <div key={stat.day} className="flex items-center justify-between">
                  <span className="text-sm font-avenir text-brand-text/70">
                    {formatDate(stat.day)}
                  </span>
                  <div className="flex items-center gap-2 flex-1 mx-3">
                    <div className="flex-1 bg-brand-gray rounded-full h-2">
                      <div
                        className="bg-brand-accent h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(5, (stat.total / Math.max(...dailyStats.map(s => s.total))) * 100)}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-avenir-medium text-brand-text min-w-[20px] text-right">
                      {stat.total}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-brand-text/70 font-avenir">
                Žádná data za vybrané období
              </p>
            </div>
          )}
        </div>

        {/* Branches Info */}
        {branches.length > 0 && (
          <div className="bg-white rounded-card shadow-soft p-6">
            <h3 className="text-lg font-avenir-medium text-brand-text mb-4">
              Pobočky
            </h3>
            <div className="space-y-3">
              {branches.map((branch) => (
                <div key={branch.id} className="flex justify-between items-center">
                  <div>
                    <span className="font-avenir-medium text-brand-text">
                      {branch.name}
                    </span>
                    {branch.city && (
                      <p className="text-sm text-brand-text/70 font-avenir">
                        {branch.city}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-brand-error/10 border border-brand-error/20 rounded-card p-4">
            <h4 className="font-avenir-medium text-brand-error mb-2">
              Chyba při načítání
            </h4>
            <p className="text-sm text-brand-error/80 font-avenir">{error}</p>
          </div>
        )}
      </div>
    </main>
  );
}