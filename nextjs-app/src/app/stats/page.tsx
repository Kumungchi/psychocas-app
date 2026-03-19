'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { AlertCircle, BarChart3, Filter, RefreshCcw, TrendingUp, Users } from 'lucide-react';
import Navigation from '@/components/Navigation';
import useMemberContext from '@/hooks/useMemberContext';
import useLocale from '@/hooks/useLocale';
import type { MemberRole } from '@/types/member';
import { colors } from '@/ui/theme';

type Period = 'day' | 'week' | 'month';

interface BranchOption {
  id: string;
  name: string;
}

interface RedemptionRow {
  redeemed_at: string;
  branch_id: string | null;
}

interface ChartDatum {
  label: string;
  total: number;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function getRangeStart(period: Period): Date {
  const now = new Date();
  const start = new Date(now);

  switch (period) {
    case 'day':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      break;
  }

  return start;
}

function buildDemoRedemptions(period: Period): RedemptionRow[] {
  const now = Date.now();
  const base = getRangeStart(period).getTime();
  const total = period === 'day' ? 32 : period === 'week' ? 140 : 480;
  const entries: RedemptionRow[] = [];

  for (let index = 0; index < total; index += 1) {
    const offset = Math.floor(Math.random() * (now - base));
    entries.push({ redeemed_at: new Date(base + offset).toISOString(), branch_id: 'demo-branch' });
  }

  return entries;
}

function formatHourLabel(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

function buildChartData(
  period: Period,
  redemptions: RedemptionRow[],
  formatMessage: (key: string, vars: Record<string, string | number>) => string,
  weekdayLabels: Record<number, string>
): ChartDatum[] {
  if (period === 'day') {
    const counts = Array.from({ length: 24 }, (_, hour) => ({ label: formatHourLabel(hour), total: 0 }));
    redemptions.forEach((row) => {
      const date = new Date(row.redeemed_at);
      counts[date.getHours()].total += 1;
    });
    return counts;
  }

  if (period === 'week') {
    const counts = Array.from({ length: 7 }, (_, index) => ({ label: weekdayLabels[index], total: 0 }));
    redemptions.forEach((row) => {
      const date = new Date(row.redeemed_at);
      const dayIndex = (date.getDay() + 6) % 7;
      counts[dayIndex].total += 1;
    });
    return counts;
  }

  const start = getRangeStart('month');
  const groups: Map<number, ChartDatum> = new Map();
  redemptions.forEach((row) => {
    const date = new Date(row.redeemed_at);
    const diff = Math.floor((date.getTime() - start.getTime()) / (7 * DAY_IN_MS));
    const weekIndex = diff < 0 ? 0 : diff;
    const existing = groups.get(weekIndex) ?? {
      label: formatMessage('stats.chart.weekLabel', { index: weekIndex + 1 }),
      total: 0,
    };
    existing.total += 1;
    groups.set(weekIndex, existing);
  });

  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, value]) => value);
}

export default function Statistics() {
  const { t, formatMessage, locale } = useLocale();
  const { status, member, error, refresh } = useMemberContext({ scope: 'stats-page' });

  const memberRole: MemberRole = member?.role ?? 'member';
  const isManager = memberRole === 'manager';
  const isCouncil = memberRole === 'council';
  const canView = isManager || isCouncil;
  const isDemo = member?.origin === 'demo';

  const [period, setPeriod] = useState<Period>('week');
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [branchLoading, setBranchLoading] = useState(false);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCouncil || isDemo) {
      return;
    }

    let isActive = true;
    const loadBranches = async () => {
      setBranchLoading(true);
      setBranchError(null);

      const { data, error: loadError } = await supabase
        .from('branches')
        .select('id, name')
        .order('name', { ascending: true });

      if (!isActive) {
        return;
      }

      if (loadError) {
        setBranchError(t('stats.states.branchError'));
      } else {
        setBranchOptions(
          (data ?? [])
            .filter((row): row is { id: string; name: string } => Boolean(row?.id && row?.name))
            .map((row) => ({ id: row.id, name: row.name! }))
        );
      }

      setBranchLoading(false);
    };

    void loadBranches();

    return () => {
      isActive = false;
    };
  }, [isCouncil, isDemo, t]);

  useEffect(() => {
    if (isManager) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync derived state from role
      setSelectedBranchId(member?.branch?.id ?? null);
    } else if (isCouncil) {
       
      setSelectedBranchId(null);
    }
  }, [isCouncil, isManager, member?.branch?.id]);

  useEffect(() => {
    if (!canView) {
      return;
    }

    let isActive = true;
    const loadRedemptions = async () => {
      setDataLoading(true);
      setDataError(null);

      if (isDemo) {
        setRedemptions(buildDemoRedemptions(period));
        setDataLoading(false);
        return;
      }

      const start = getRangeStart(period);
      let query = supabase
        .from('redemptions')
        .select('redeemed_at, branch_id')
        .gte('redeemed_at', start.toISOString())
        .order('redeemed_at', { ascending: true });

      if (isManager && member?.branch?.id) {
        query = query.eq('branch_id', member.branch.id);
      } else if (isCouncil && selectedBranchId) {
        query = query.eq('branch_id', selectedBranchId);
      }

      const { data, error: loadError } = await query;

      if (!isActive) {
        return;
      }

      if (loadError) {
        console.error('Failed to load redemptions', loadError);
        setDataError(t('stats.states.dataError'));
        setRedemptions([]);
      } else {
        setRedemptions((data ?? []) as RedemptionRow[]);
      }

      setDataLoading(false);
    };

    void loadRedemptions();

    return () => {
      isActive = false;
    };
  }, [canView, isCouncil, isDemo, isManager, member?.branch?.id, period, selectedBranchId, t]);

  const weekdayLabels = useMemo(
    () => ({
      0: t('stats.weekdays.monday'),
      1: t('stats.weekdays.tuesday'),
      2: t('stats.weekdays.wednesday'),
      3: t('stats.weekdays.thursday'),
      4: t('stats.weekdays.friday'),
      5: t('stats.weekdays.saturday'),
      6: t('stats.weekdays.sunday'),
    }),
    [t]
  );

  const branchName = useMemo(() => {
    if (isManager) {
      return member?.branch?.name ?? t('stats.subheadingUnknownBranch');
    }

    if (isCouncil && selectedBranchId) {
      return branchOptions.find((option) => option.id === selectedBranchId)?.name ?? null;
    }

    return null;
  }, [branchOptions, isCouncil, isManager, member?.branch?.name, selectedBranchId, t]);

  const chartData = useMemo(
    () => buildChartData(period, redemptions, formatMessage, weekdayLabels),
    [formatMessage, period, redemptions, weekdayLabels]
  );

  const totalValidations = useMemo(
    () => chartData.reduce((sum, datum) => sum + datum.total, 0),
    [chartData]
  );

  const averagePerSlot = useMemo(
    () => (chartData.length > 0 ? Math.round(totalValidations / chartData.length) : 0),
    [chartData.length, totalValidations]
  );

  const busiestSlot = useMemo(() => {
    if (chartData.length === 0) {
      return null;
    }
    return chartData.reduce((max, current) => (current.total > max.total ? current : max), chartData[0]);
  }, [chartData]);

  const lastRedemption = useMemo(() => {
    if (redemptions.length === 0) {
      return null;
    }
    const latest = redemptions[redemptions.length - 1];
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(latest.redeemed_at));
    } catch {
      return latest.redeemed_at;
    }
  }, [locale, redemptions]);

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card" style={{ color: colors.textSecondary }}>
            {t('stats.states.loadingMember')}
          </div>
        </div>
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card" style={{ color: colors.textSecondary }}>
            {t('stats.states.loginRequired')}
          </div>
        </div>
      </main>
    );
  }

  if (status === 'error' || !member) {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card space-y-3">
            <div className="flex items-center gap-2" style={{ color: colors.danger }}>
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">{t('stats.states.memberErrorTitle')}</p>
            </div>
            <p style={{ color: colors.textSecondary }}>{error ?? t('stats.states.memberErrorDescription')}</p>
            <button onClick={refresh} className="psychocas-button-primary flex items-center gap-2 w-max">
              <RefreshCcw className="h-4 w-4" /> {t('stats.states.refresh')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!canView) {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card space-y-2">
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {t('stats.states.accessDeniedTitle')}
            </h2>
            <p style={{ color: colors.textSecondary }}>{t('stats.states.accessDeniedDescription')}</p>
          </div>
        </div>
        <Navigation userRole={memberRole} />
      </main>
    );
  }

  const showBranchDetail = isManager || (isCouncil && Boolean(selectedBranchId));
  const subheading = branchName
    ? formatMessage('stats.subheadingWithBranch', { branch: branchName })
    : t('stats.subheadingAll');

  return (
    <main className="psychocas-section pb-20">
      <div className="psychocas-container space-y-6 fade-in-up">
        <header className="pt-6 text-center space-y-2">
          <h1>{t('stats.heading')}</h1>
          <p style={{ color: colors.textSecondary }}>{subheading}</p>
          {isDemo && (
            <p className="text-sm" style={{ color: colors.warning }}>
              {t('stats.states.demoNotice')}
            </p>
          )}
        </header>

        {isCouncil && !isDemo && (
          <section className="psychocas-card space-y-3">
            <div className="flex items-center gap-2" style={{ color: colors.textPrimary }}>
              <Filter className="h-4 w-4" />
              <span>{t('stats.filters.branchLabel')}</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="psychocas-input"
                value={selectedBranchId ?? ''}
                onChange={(event) => setSelectedBranchId(event.target.value || null)}
              >
                <option value="">{t('stats.filters.branchPlaceholder')}</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <button onClick={() => setSelectedBranchId(null)} className="psychocas-button-secondary">
                {t('stats.filters.clear')}
              </button>
            </div>
            {branchLoading && <p style={{ color: colors.textSecondary }}>{t('stats.states.branchLoading')}</p>}
            {branchError && <p style={{ color: colors.danger }}>{branchError}</p>}
            {!selectedBranchId && !branchLoading && !branchError && (
              <p style={{ color: colors.textSecondary }}>{t('stats.states.branchEmpty')}</p>
            )}
          </section>
        )}

        <section className="psychocas-card">
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm font-medium" style={{ color: colors.textPrimary }}>
              {t('stats.filters.periodLabel')}
            </label>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
              className="psychocas-input"
              style={{ maxWidth: '14rem' }}
            >
              <option value="day">{t('stats.filters.day')}</option>
              <option value="week">{t('stats.filters.week')}</option>
              <option value="month">{t('stats.filters.month')}</option>
            </select>
          </div>
        </section>

        {showBranchDetail ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="psychocas-card space-y-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg p-2" style={{ backgroundColor: colors.brandSurface }}>
                    <Users className="h-5 w-5" style={{ color: colors.brandPrimary }} />
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      {t('stats.cards.total')}
                    </p>
                    <p className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                      {totalValidations}
                    </p>
                  </div>
                </div>
              </div>

              <div className="psychocas-card space-y-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg p-2" style={{ backgroundColor: colors.infoSurface }}>
                    <TrendingUp className="h-5 w-5" style={{ color: colors.info }} />
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      {t('stats.cards.average')}
                    </p>
                    <p className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                      {averagePerSlot}
                    </p>
                  </div>
                </div>
              </div>

              <div className="psychocas-card space-y-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg p-2" style={{ backgroundColor: colors.warningSurface }}>
                    <BarChart3 className="h-5 w-5" style={{ color: colors.warning }} />
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      {t('stats.cards.busiest')}
                    </p>
                    <p className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                      {busiestSlot ? busiestSlot.label : t('stats.states.dataEmpty')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="psychocas-card space-y-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg p-2" style={{ backgroundColor: colors.infoSurfaceAlt }}>
                    <RefreshCcw className="h-5 w-5" style={{ color: colors.infoStrong }} />
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      {t('stats.cards.lastRedemption')}
                    </p>
                    <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                      {lastRedemption ?? '—'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="psychocas-card space-y-4">
              <h3 style={{ color: colors.textPrimary }}>{t(`stats.chart.heading.${period}`)}</h3>

              {dataLoading ? (
                <p style={{ color: colors.textSecondary }}>{t('stats.states.dataLoading')}</p>
              ) : chartData.length === 0 ? (
                <p style={{ color: colors.textSecondary }}>{t('stats.states.dataEmpty')}</p>
              ) : (
                <div className="space-y-3">
                  {chartData.map((datum) => {
                    const percentage = totalValidations === 0 ? 0 : Math.round((datum.total / totalValidations) * 100);
                    return (
                      <div key={datum.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm" style={{ color: colors.textSecondary }}>
                          <span>{datum.label}</span>
                          <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{datum.total}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%`, backgroundColor: colors.brandPrimary }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {dataError && <p style={{ color: colors.danger }}>{dataError}</p>}
            </section>
          </>
        ) : (
          <section className="psychocas-card" style={{ color: colors.textSecondary }}>
            {t('stats.states.noBranchSelected')}
          </section>
        )}
      </div>

      <Navigation userRole={memberRole} />
    </main>
  );
}
