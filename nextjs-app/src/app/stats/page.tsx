'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { TrendingUp, Users, Percent, Clock, AlertCircle, Filter, RefreshCcw } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { useMemberContext } from '@/hooks/useMemberContext';
import type { MemberRole } from '@/types/member';

type Period = 'day' | 'week' | 'month';

type DayChartItem = { time: string; validations: number };
type WeekChartItem = { day: string; validations: number };
type MonthChartItem = { week: string; validations: number };

type ChartItem = DayChartItem | WeekChartItem | MonthChartItem;

type BranchMockKey = 'default' | 'praha' | 'brno' | 'ostrava';

const mockData: Record<BranchMockKey, Record<Period, ChartItem[]>> = {
  default: {
    day: [
      { time: '9:00', validations: 12 },
      { time: '10:00', validations: 18 },
      { time: '11:00', validations: 25 },
      { time: '12:00', validations: 31 },
      { time: '13:00', validations: 28 },
      { time: '14:00', validations: 22 },
      { time: '15:00', validations: 16 },
      { time: '16:00', validations: 19 },
    ],
    week: [
      { day: 'Po', validations: 145 },
      { day: 'Út', validations: 162 },
      { day: 'St', validations: 178 },
      { day: 'Čt', validations: 153 },
      { day: 'Pá', validations: 189 },
      { day: 'So', validations: 234 },
      { day: 'Ne', validations: 198 },
    ],
    month: [
      { week: '1. týden', validations: 1259 },
      { week: '2. týden', validations: 1387 },
      { week: '3. týden', validations: 1456 },
      { week: '4. týden', validations: 1332 },
    ]
  },
  praha: {
    day: [
      { time: '9:00', validations: 15 },
      { time: '10:00', validations: 21 },
      { time: '11:00', validations: 29 },
      { time: '12:00', validations: 34 },
      { time: '13:00', validations: 32 },
      { time: '14:00', validations: 25 },
      { time: '15:00', validations: 21 },
      { time: '16:00', validations: 18 },
    ],
    week: [
      { day: 'Po', validations: 162 },
      { day: 'Út', validations: 188 },
      { day: 'St', validations: 196 },
      { day: 'Čt', validations: 171 },
      { day: 'Pá', validations: 204 },
      { day: 'So', validations: 248 },
      { day: 'Ne', validations: 211 },
    ],
    month: [
      { week: '1. týden', validations: 1321 },
      { week: '2. týden', validations: 1448 },
      { week: '3. týden', validations: 1522 },
      { week: '4. týden', validations: 1415 },
    ]
  },
  brno: {
    day: [
      { time: '9:00', validations: 9 },
      { time: '10:00', validations: 13 },
      { time: '11:00', validations: 18 },
      { time: '12:00', validations: 22 },
      { time: '13:00', validations: 19 },
      { time: '14:00', validations: 17 },
      { time: '15:00', validations: 12 },
      { time: '16:00', validations: 14 },
    ],
    week: [
      { day: 'Po', validations: 118 },
      { day: 'Út', validations: 132 },
      { day: 'St', validations: 141 },
      { day: 'Čt', validations: 128 },
      { day: 'Pá', validations: 156 },
      { day: 'So', validations: 177 },
      { day: 'Ne', validations: 166 },
    ],
    month: [
      { week: '1. týden', validations: 1098 },
      { week: '2. týden', validations: 1162 },
      { week: '3. týden', validations: 1210 },
      { week: '4. týden', validations: 1154 },
    ]
  },
  ostrava: {
    day: [
      { time: '9:00', validations: 7 },
      { time: '10:00', validations: 12 },
      { time: '11:00', validations: 16 },
      { time: '12:00', validations: 19 },
      { time: '13:00', validations: 20 },
      { time: '14:00', validations: 16 },
      { time: '15:00', validations: 13 },
      { time: '16:00', validations: 11 },
    ],
    week: [
      { day: 'Po', validations: 102 },
      { day: 'Út', validations: 119 },
      { day: 'St', validations: 126 },
      { day: 'Čt', validations: 111 },
      { day: 'Pá', validations: 134 },
      { day: 'So', validations: 158 },
      { day: 'Ne', validations: 147 },
    ],
    month: [
      { week: '1. týden', validations: 984 },
      { week: '2. týden', validations: 1027 },
      { week: '3. týden', validations: 1081 },
      { week: '4. týden', validations: 999 },
    ]
  }
};

const getLabel = (item: ChartItem): string => {
  if ('time' in item) {
    return item.time;
  }

  if ('day' in item) {
    return item.day;
  }

  return item.week;
};

interface BranchOption {
  id: string;
  name: string;
}

const resolveBranchKey = (name: string | null | undefined): BranchMockKey => {
  const normalized = (name ?? '').toLowerCase();
  if (normalized.includes('praha')) {
    return 'praha';
  }
  if (normalized.includes('brno')) {
    return 'brno';
  }
  if (normalized.includes('ostrava')) {
    return 'ostrava';
  }
  return 'default';
};

export default function Statistics() {
  const { status, member, error, refresh } = useMemberContext({ scope: 'stats-page' });
  const [period, setPeriod] = useState<Period>('week');
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [isBranchLoading, setIsBranchLoading] = useState(false);

  const memberRole: MemberRole = member?.role ?? 'member';
  const isManager = memberRole === 'manager';
  const isCouncil = memberRole === 'council';
  const canView = isManager || isCouncil;

  useEffect(() => {
    if (!isCouncil) {
      return;
    }

    let isActive = true;
    const loadBranches = async () => {
      setIsBranchLoading(true);
      setBranchError(null);
      const { data, error: branchLoadError } = await supabase
        .from('branches')
        .select('id, name')
        .order('name', { ascending: true });

      if (!isActive) {
        return;
      }

      if (branchLoadError) {
        setBranchError('Nepodařilo se načíst seznam poboček.');
      } else {
        setBranchOptions(
          (data ?? [])
            .filter((row): row is { id: string; name: string } => Boolean(row?.id && row?.name))
            .map((row) => ({ id: row.id, name: row.name! }))
        );
      }
      setIsBranchLoading(false);
    };

    loadBranches();

    return () => {
      isActive = false;
    };
  }, [isCouncil]);

  useEffect(() => {
    if (isManager) {
      const managerBranchId = member?.branch?.id ?? null;
      setSelectedBranchId(managerBranchId);
    } else if (isCouncil) {
      setSelectedBranchId(null);
    }
  }, [isManager, isCouncil, member?.branch?.id]);

  const resolvedBranchName = useMemo(() => {
    if (isManager) {
      return member?.branch?.name ?? 'Nepřiřazená pobočka';
    }

    if (isCouncil && selectedBranchId) {
      return branchOptions.find((option) => option.id === selectedBranchId)?.name ?? 'Vybraná pobočka';
    }

    return null;
  }, [isCouncil, isManager, member?.branch?.name, branchOptions, selectedBranchId]);

  const dataSourceKey: BranchMockKey = useMemo(() => {
    const fallbackBranch = resolveBranchKey(member?.branch?.name);
    if (isManager) {
      return fallbackBranch;
    }

    if (isCouncil && selectedBranchId) {
      const option = branchOptions.find((branch) => branch.id === selectedBranchId);
      return resolveBranchKey(option?.name);
    }

    return 'default';
  }, [branchOptions, isCouncil, isManager, member?.branch?.name, selectedBranchId]);

  const chartData = useMemo(() => mockData[dataSourceKey][period], [dataSourceKey, period]);

  const totalValidations = useMemo(() => chartData.reduce((sum, item) => sum + item.validations, 0), [chartData]);
  const avgPerPeriod = useMemo(() => Math.round(totalValidations / chartData.length), [chartData.length, totalValidations]);
  const maxValidation = useMemo(() => Math.max(...chartData.map((item) => item.validations)), [chartData]);

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container space-y-6 fade-in-up">
          <div className="psychocas-card">
            <p style={{ color: '#666666' }}>Načítám informace o členství…</p>
          </div>
        </div>
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container space-y-6 fade-in-up">
          <div className="psychocas-card">
            <p style={{ color: '#666666' }}>Pro zobrazení statistik se prosím přihlaste.</p>
          </div>
        </div>
      </main>
    );
  }

  if (status === 'error' || !member) {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container space-y-6 fade-in-up">
          <div className="psychocas-card space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">Nepodařilo se načíst člena</p>
            </div>
            <p style={{ color: '#666666' }}>{error ?? 'Zkuste prosím stránku obnovit.'}</p>
            <button
              onClick={refresh}
              className="psychocas-button-primary flex items-center gap-2 w-max"
            >
              <RefreshCcw className="w-4 h-4" /> Obnovit
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!canView) {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container space-y-6 fade-in-up">
          <div className="psychocas-card space-y-2">
            <h2 className="text-lg font-semibold" style={{ color: '#333333' }}>Přístup zamítnut</h2>
            <p style={{ color: '#666666' }}>
              Statistiky jsou dostupné pouze pro manažery a členy rady. Pro další informace kontaktujte vedení.
            </p>
          </div>
        </div>
        <Navigation userRole={memberRole} />
      </main>
    );
  }

  const showBranchDetail = isManager || (isCouncil && Boolean(selectedBranchId));

  return (
    <main className="psychocas-section pb-20">
      <div className="psychocas-container space-y-6 fade-in-up">
        {/* Header */}
        <div className="text-center pt-6">
          <h1 className="mb-3">Statistiky</h1>
          <p style={{ color: '#666666' }}>
            Přehled využití slevových kódů {showBranchDetail && resolvedBranchName ? `– ${resolvedBranchName}` : ''}
          </p>
        </div>

        {isCouncil && (
          <div className="psychocas-card space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#333333' }}>
              <Filter className="w-4 h-4" />
              <span>Vyberte pobočku pro zobrazení detailů</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="psychocas-input"
                value={selectedBranchId ?? ''}
                onChange={(event) => setSelectedBranchId(event.target.value || null)}
              >
                <option value="">Vyberte pobočku…</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setSelectedBranchId(null)}
                className="psychocas-button-secondary"
              >
                Zrušit filtr
              </button>
            </div>
            {isBranchLoading && <p style={{ color: '#666666' }}>Načítám pobočky…</p>}
            {branchError && <p className="text-sm" style={{ color: '#c62828' }}>{branchError}</p>}
            {!selectedBranchId && !isBranchLoading && !branchError && (
              <p className="text-sm" style={{ color: '#666666' }}>
                Pro zobrazení výkonu rady je nutné zvolit konkrétní pobočku.
              </p>
            )}
          </div>
        )}

        {/* Filter */}
        <div className="psychocas-card">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium" style={{ color: '#333333' }}>
              Období:
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="psychocas-input flex-1"
              style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
            >
              <option value="day">Den</option>
              <option value="week">Týden</option>
              <option value="month">Měsíc</option>
            </select>
          </div>
        </div>

        {showBranchDetail ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4">
              {/* Total */}
              <div className="psychocas-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: '#e3f2fd' }}>
                    <Users className="w-5 h-5" style={{ color: '#1d4f7d' }} />
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: '#666666' }}>Celkem ověření</p>
                    <p className="text-lg font-semibold" style={{ color: '#333333' }}>{totalValidations}</p>
                  </div>
                </div>
              </div>

              {/* Average */}
              <div className="psychocas-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: '#e1f5fe' }}>
                    <TrendingUp className="w-5 h-5" style={{ color: '#049edb' }} />
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: '#666666' }}>Průměr na období</p>
                    <p className="text-lg font-semibold" style={{ color: '#333333' }}>{avgPerPeriod}</p>
                  </div>
                </div>
              </div>

              {/* Success Rate */}
              <div className="psychocas-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: '#e8f5e8' }}>
                    <Percent className="w-5 h-5" style={{ color: '#2e7d32' }} />
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: '#666666' }}>Úspěšnost</p>
                    <p className="text-lg font-semibold" style={{ color: '#333333' }}>94%</p>
                  </div>
                </div>
              </div>

              {/* Avg Time */}
              <div className="psychocas-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: '#fff3e0' }}>
                    <Clock className="w-5 h-5" style={{ color: '#ff9800' }} />
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: '#666666' }}>Průměrný čas</p>
                    <p className="text-lg font-semibold" style={{ color: '#333333' }}>2.3s</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="psychocas-card">
              <h3 className="mb-6" style={{ color: '#333333' }}>
                Ověření kódů – {period === 'day' ? 'Dnes' : period === 'week' ? 'Tento týden' : 'Tento měsíc'}
              </h3>

              <div className="space-y-3">
                {chartData.map((item, index) => {
                  const label = getLabel(item);
                  const percentage = (item.validations / maxValidation) * 100;

                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span style={{ color: '#666666' }}>{label}</span>
                        <span style={{ color: '#333333', fontWeight: '600' }}>{item.validations}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: '#1d4f7d'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="psychocas-card">
              <h3 className="mb-3" style={{ color: '#333333' }}>Shrnutí</h3>
              <div className="space-y-2 text-sm" style={{ color: '#666666' }}>
                <p>
                  • Nejaktivnější {period === 'day' ? 'hodina' : period === 'week' ? 'den' : 'týden'}:{' '}
                  <strong style={{ color: '#333333' }}>
                    {(() => {
                      const maxItem = chartData.reduce((max, item) => item.validations > max.validations ? item : max, chartData[0]);
                      return getLabel(maxItem);
                    })()}
                  </strong>
                </p>
                <p>• Celkem aktivních členů: <strong style={{ color: '#333333' }}>1,247</strong></p>
                <p>• Průměrná doba ověření: <strong style={{ color: '#333333' }}>2.3 sekundy</strong></p>
              </div>
            </div>
          </>
        ) : (
          <div className="psychocas-card">
            <p style={{ color: '#666666' }}>
              Zvolte pobočku a poté se zobrazí podrobné statistiky. Členové rady mají přístup k přehledům všech poboček po výběru filtru.
            </p>
          </div>
        )}

        {isCouncil && (
          <div className="psychocas-card" style={{ backgroundColor: '#f5f5f5' }}>
            <h3 className="mb-2" style={{ color: '#333333' }}>Kontakty vedení</h3>
            <ul className="space-y-1 text-sm" style={{ color: '#666666' }}>
              <li>PR tým: <a href="mailto:pr@psychocas.cz" className="underline">pr@psychocas.cz</a></li>
              <li>HR tým: <a href="mailto:hr@psychocas.cz" className="underline">hr@psychocas.cz</a></li>
            </ul>
          </div>
        )}
      </div>

      {/* Navigation Bar */}
      <Navigation userRole={memberRole} />
    </main>
  );
}
