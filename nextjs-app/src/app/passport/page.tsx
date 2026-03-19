'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import useMemberContext from '@/hooks/useMemberContext';
import useLocale from '@/hooks/useLocale';
import Navigation from '@/components/Navigation';
import {
  ArrowLeft, CalendarDays, Flame, PiggyBank, Tag, Ticket,
} from 'lucide-react';
import { colors } from '@/ui/theme';

interface RedeemedTokenRow {
  id: string
  redeemed_at: string
  discount: {
    title: string
    discount_value: string
    partner: {
      name: string
      category: string
    } | null
  } | null
}

interface MonthPoint {
  label: string
  total: number
}

interface CategoryPoint {
  key: string
  label: string
  total: number
}

const CATEGORY_LABELS_CS: Record<string, string> = {
  cafe: 'Kavárny',
  shop: 'Obchody',
  event: 'Akce',
  service: 'Služby',
  other: 'Ostatní',
};

const CATEGORY_LABELS_EN: Record<string, string> = {
  cafe: 'Cafés',
  shop: 'Shops',
  event: 'Events',
  service: 'Services',
  other: 'Other',
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentMonthlyStreak(monthsWithActivity: Set<string>): number {
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);

  let streak = 0;
  while (monthsWithActivity.has(monthKey(cursor))) {
    streak += 1;
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return streak;
}

function KpiCard({
  icon, value, label, hint, small,
}: {
  icon: React.ReactNode
  value: string
  label: string
  hint: string
  small?: boolean
}) {
  return (
    <div className="psychocas-card text-center" style={{ padding: '1rem' }}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p
        className="font-bold truncate"
        style={{
          color: colors.brandPrimary,
          fontSize: small ? '0.95rem' : '1.45rem',
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
      <p style={{ color: colors.textSecondary, fontSize: '0.75rem', marginTop: 2 }}>{label}</p>
      <p style={{ color: '#b0b0b0', fontSize: '0.72rem', marginTop: 2 }}>{hint}</p>
    </div>
  );
}

export default function SavingsPassport() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { status, member } = useMemberContext({ scope: 'passport-page' });
  const memberRole = member?.role ?? 'member';

  const [rows, setRows] = useState<RedeemedTokenRow[]>([]);
  const [loading, setLoading] = useState(true);

  const categoryLabels = locale === 'cs' ? CATEGORY_LABELS_CS : CATEGORY_LABELS_EN;

  useEffect(() => {
    if (status !== 'ready' || !member) return;

    async function fetchPassportData() {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('tokens')
        .select('id, redeemed_at, discount:discounts(title, discount_value, partner:partners(name, category))')
        .eq('member_id', member!.branch_id ? member!.branch_id : session.user.id)
        .not('redeemed_at', 'is', null)
        .order('redeemed_at', { ascending: false });

      setRows((data as RedeemedTokenRow[] | null) ?? []);
      setLoading(false);
    }

    void fetchPassportData();
  }, [status, member]);

  const totalRedeemed = rows.length;

  const streakMonths = useMemo(() => {
    const keys = new Set(
      rows.map((row) => {
        const d = new Date(row.redeemed_at);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return monthKey(d);
      }),
    );
    return getCurrentMonthlyStreak(keys);
  }, [rows]);

  const monthlyChartData: MonthPoint[] = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale === 'cs' ? 'cs-CZ' : 'en-US', { month: 'short' });
    const now = new Date();
    const points: MonthPoint[] = [];

    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      const total = rows.filter((row) => monthKey(new Date(row.redeemed_at)) === key).length;
      points.push({
        label: formatter.format(d).replace('.', ''),
        total,
      });
    }

    return points;
  }, [rows, locale]);

  const categoryData: CategoryPoint[] = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const category = row.discount?.partner?.category ?? 'other';
      counts[category] = (counts[category] ?? 0) + 1;
    }

    return Object.entries(counts)
      .map(([key, total]) => ({
        key,
        label: categoryLabels[key] ?? categoryLabels.other,
        total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [rows, categoryLabels]);

  const topCategory = categoryData[0]?.label ?? '—';

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card" style={{ color: colors.textSecondary }}>
            {t('common.loading')}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="psychocas-section pb-20">
      <div className="psychocas-container space-y-4 fade-in-up">
        <div className="flex items-center gap-3 pt-6">
          <button
            onClick={() => router.push('/home')}
            className="p-2 rounded-full transition-all"
            style={{
              color: colors.brandPrimary,
              border: `1px solid ${colors.brandPrimary}`,
              backgroundColor: colors.background,
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1>{t('savingsPassport.heading')}</h1>
        </div>

        {loading ? (
          <div className="psychocas-card text-center py-12">
            <div
              className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto"
              style={{ borderColor: colors.brandPrimary }}
            />
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <KpiCard
                icon={<PiggyBank className="w-5 h-5" style={{ color: '#16a34a' }} />}
                value={String(totalRedeemed)}
                label={t('savingsPassport.totalRedemptions')}
                hint={locale === 'cs' ? 'uplatněných benefitů' : 'redeemed benefits'}
              />
              <KpiCard
                icon={<Flame className="w-5 h-5" style={{ color: '#ea580c' }} />}
                value={`${streakMonths} m`}
                label={t('savingsPassport.streakMonths')}
                hint={streakMonths > 0
                  ? (locale === 'cs' ? 'aktivních měsíců v řadě' : 'consecutive active months')
                  : (locale === 'cs' ? 'zatím bez série' : 'no streak yet')}
              />
              <KpiCard
                icon={<Tag className="w-5 h-5" style={{ color: '#0ea5e9' }} />}
                value={topCategory}
                label={locale === 'cs' ? 'Top kategorie' : 'Top category'}
                hint={locale === 'cs' ? 'nejčastěji využíváš' : 'most used'}
                small
              />
              <KpiCard
                icon={<Ticket className="w-5 h-5" style={{ color: '#7c3aed' }} />}
                value={String(rows.slice(0, 30).length)}
                label={locale === 'cs' ? 'Posledních 30' : 'Last 30'}
                hint={locale === 'cs' ? 'využitých benefitů' : 'used benefits'}
              />
            </div>

            {/* Monthly activity — simple bar chart using CSS */}
            <div className="psychocas-card">
              <p className="font-semibold mb-4" style={{ color: colors.textPrimary }}>
                {t('savingsPassport.monthlyActivity')}
              </p>

              {totalRedeemed === 0 ? (
                <div className="text-center py-10">
                  <p style={{ color: colors.textSecondary, fontSize: '0.9rem' }}>
                    {t('savingsPassport.noActivity')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {monthlyChartData.map((point) => {
                    const maxTotal = Math.max(...monthlyChartData.map((p) => p.total), 1);
                    const percentage = Math.round((point.total / maxTotal) * 100);
                    return (
                      <div key={point.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm" style={{ color: colors.textSecondary }}>
                          <span>{point.label}</span>
                          <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{point.total}</span>
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
            </div>

            {/* Category breakdown */}
            <div className="psychocas-card space-y-3">
              <p className="font-semibold" style={{ color: colors.textPrimary }}>
                {t('savingsPassport.byCategory')}
              </p>
              {categoryData.length === 0 ? (
                <p style={{ color: colors.textSecondary, fontSize: '0.9rem' }}>
                  {t('savingsPassport.noActivity')}
                </p>
              ) : (
                categoryData.map((entry) => {
                  const ratio = totalRedeemed > 0 ? Math.round((entry.total / totalRedeemed) * 100) : 0;
                  return (
                    <div key={entry.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: colors.textSecondary, fontSize: '0.85rem' }}>{entry.label}</span>
                        <span style={{ color: colors.textSecondary, fontSize: '0.8rem' }}>{entry.total}x ({ratio}%)</span>
                      </div>
                      <div style={{ backgroundColor: '#eef2f6', borderRadius: 9999, height: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${ratio}%`, backgroundColor: colors.accent, height: '100%' }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Recent redemptions */}
            <div className="psychocas-card space-y-3">
              <p className="font-semibold flex items-center gap-2" style={{ color: colors.textPrimary }}>
                <CalendarDays className="w-4 h-4" />
                {t('savingsPassport.lastActivity')}
              </p>
              {rows.slice(0, 5).map((row) => (
                <div key={row.id} className="flex items-start justify-between gap-3" style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '0.6rem' }}>
                  <div className="min-w-0">
                    <p className="font-medium truncate" style={{ color: colors.brandPrimary, fontSize: '0.9rem', margin: 0 }}>
                      {row.discount?.partner?.name ?? 'Partner'}
                    </p>
                    <p className="truncate" style={{ color: colors.textSecondary, fontSize: '0.8rem', margin: 0 }}>
                      {row.discount?.title ?? (locale === 'cs' ? 'Sleva' : 'Discount')}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ color: colors.success, fontSize: '0.8rem', fontWeight: 600, margin: 0 }}>
                      {row.discount?.discount_value ?? 'Benefit'}
                    </p>
                    <p style={{ color: colors.textSecondary, fontSize: '0.75rem', margin: 0 }}>
                      {new Date(row.redeemed_at).toLocaleDateString(locale === 'cs' ? 'cs-CZ' : 'en-US')}
                    </p>
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <p style={{ color: colors.textSecondary, fontSize: '0.9rem', margin: 0 }}>
                  {t('savingsPassport.noActivity')}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <Navigation userRole={memberRole} />
    </main>
  );
}
