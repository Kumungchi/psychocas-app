import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
  ArrowLeft, CalendarDays, Flame, PiggyBank, Tag, Ticket,
} from 'lucide-react'
import {
  Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

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

const CATEGORY_LABELS: Record<string, string> = {
  cafe: 'Kavárny',
  shop: 'Obchody',
  event: 'Akce',
  service: 'Služby',
  other: 'Ostatní',
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getCurrentMonthlyStreak(monthsWithActivity: Set<string>): number {
  const cursor = new Date()
  cursor.setDate(1)
  cursor.setHours(0, 0, 0, 0)

  let streak = 0
  while (monthsWithActivity.has(monthKey(cursor))) {
    streak += 1
    cursor.setMonth(cursor.getMonth() - 1)
  }
  return streak
}

export function SavingsPassportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<RedeemedTokenRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPassportData() {
      if (!user) return

      setLoading(true)
      const { data } = await supabase
        .from('tokens')
        .select('id, redeemed_at, discount:discounts(title, discount_value, partner:partners(name, category))')
        .eq('member_id', user.id)
        .not('redeemed_at', 'is', null)
        .order('redeemed_at', { ascending: false })

      setRows((data as RedeemedTokenRow[] | null) ?? [])
      setLoading(false)
    }

    void fetchPassportData()
  }, [user])

  const totalRedeemed = rows.length

  const streakMonths = useMemo(() => {
    const keys = new Set(
      rows.map((row) => {
        const d = new Date(row.redeemed_at)
        d.setDate(1)
        d.setHours(0, 0, 0, 0)
        return monthKey(d)
      }),
    )
    return getCurrentMonthlyStreak(keys)
  }, [rows])

  const monthlyChartData: MonthPoint[] = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('cs-CZ', { month: 'short' })
    const now = new Date()
    const points: MonthPoint[] = []

    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = monthKey(d)
      const total = rows.filter((row) => monthKey(new Date(row.redeemed_at)) === key).length
      points.push({
        label: formatter.format(d).replace('.', ''),
        total,
      })
    }

    return points
  }, [rows])

  const categoryData: CategoryPoint[] = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const row of rows) {
      const category = row.discount?.partner?.category ?? 'other'
      counts[category] = (counts[category] ?? 0) + 1
    }

    return Object.entries(counts)
      .map(([key, total]) => ({
        key,
        label: CATEGORY_LABELS[key] ?? 'Ostatní',
        total,
      }))
      .sort((a, b) => b.total - a.total)
  }, [rows])

  const topCategory = categoryData[0]?.label ?? '—'

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--psychocas-light-gray)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        backgroundColor: 'rgba(245,245,245,0.92)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        padding: 'clamp(0.75rem, 3vw, 1rem) clamp(1rem, 4vw, 1.5rem)',
      }}>
        <div style={{ maxWidth: '28rem', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/')}
            className="interactive-element"
            style={{ background: 'var(--psychocas-white)', border: '1px solid #e0e0e0', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--psychocas-primary)', cursor: 'pointer', flexShrink: 0 }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 style={{ color: 'var(--psychocas-primary)', margin: 0, fontSize: 'clamp(1.2rem, 5vw, 1.5rem)' }}>
            Savings Passport
          </h1>
        </div>
      </header>

      <main style={{ maxWidth: '28rem', margin: '0 auto', padding: 'clamp(1rem, 4vw, 1.5rem)' }} className="space-y-4 fade-in-up pb-8">
        {loading ? (
          <div className="psychocas-card text-center py-12">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--psychocas-primary)' }} />
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <KpiCard
                icon={<PiggyBank className="w-5 h-5" style={{ color: '#16a34a' }} />}
                value={String(totalRedeemed)}
                label="Ušetřeno celkem"
                hint="uplatněných benefitů"
              />
              <KpiCard
                icon={<Flame className="w-5 h-5" style={{ color: '#ea580c' }} />}
                value={`${streakMonths} m`}
                label="Měsíční série"
                hint={streakMonths > 0 ? 'aktivních měsíců v řadě' : 'zatím bez série'}
              />
              <KpiCard
                icon={<Tag className="w-5 h-5" style={{ color: '#0ea5e9' }} />}
                value={topCategory}
                label="Top kategorie"
                hint="nejčastěji využíváš"
                small
              />
              <KpiCard
                icon={<Ticket className="w-5 h-5" style={{ color: '#7c3aed' }} />}
                value={String(rows.slice(0, 30).length)}
                label="Posledních 30"
                hint="využitých benefitů"
              />
            </div>

            <div className="psychocas-card">
              <p className="font-semibold mb-4" style={{ color: 'var(--psychocas-text-gray)' }}>
                Aktivita za 6 měsíců
              </p>

              {totalRedeemed === 0 ? (
                <div className="text-center py-10">
                  <p style={{ color: '#666666', fontSize: '0.9rem' }}>Zatím nemáš žádná využití slev.</p>
                </div>
              ) : (
                <div style={{ height: 210 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#999', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#999', fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(4,158,219,0.06)' }}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, fontSize: 13 }}
                        formatter={(value: number) => [value, 'Využití']}
                      />
                      <Bar dataKey="total" fill="var(--psychocas-primary)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="psychocas-card space-y-3">
              <p className="font-semibold" style={{ color: 'var(--psychocas-text-gray)' }}>Kategorie benefitů</p>
              {categoryData.length === 0 ? (
                <p style={{ color: '#999999', fontSize: '0.9rem' }}>Až začneš využívat benefity, uvidíš zde rozložení podle kategorií.</p>
              ) : (
                categoryData.map((entry) => {
                  const ratio = totalRedeemed > 0 ? Math.round((entry.total / totalRedeemed) * 100) : 0
                  return (
                    <div key={entry.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: '#666666', fontSize: '0.85rem' }}>{entry.label}</span>
                        <span style={{ color: '#999999', fontSize: '0.8rem' }}>{entry.total}x ({ratio}%)</span>
                      </div>
                      <div style={{ backgroundColor: '#eef2f6', borderRadius: 9999, height: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${ratio}%`, backgroundColor: 'var(--psychocas-accent)', height: '100%' }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="psychocas-card space-y-3">
              <p className="font-semibold flex items-center gap-2" style={{ color: 'var(--psychocas-text-gray)' }}>
                <CalendarDays className="w-4 h-4" />
                Poslední využité benefity
              </p>
              {rows.slice(0, 5).map((row) => (
                <div key={row.id} className="flex items-start justify-between gap-3" style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '0.6rem' }}>
                  <div className="min-w-0">
                    <p className="font-medium truncate" style={{ color: 'var(--psychocas-primary)', fontSize: '0.9rem', margin: 0 }}>
                      {row.discount?.partner?.name ?? 'Partner'}
                    </p>
                    <p className="truncate" style={{ color: '#777777', fontSize: '0.8rem', margin: 0 }}>
                      {row.discount?.title ?? 'Sleva'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ color: 'var(--psychocas-status-green)', fontSize: '0.8rem', fontWeight: 600, margin: 0 }}>
                      {row.discount?.discount_value ?? 'Benefit'}
                    </p>
                    <p style={{ color: '#999999', fontSize: '0.75rem', margin: 0 }}>
                      {new Date(row.redeemed_at).toLocaleDateString('cs-CZ')}
                    </p>
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <p style={{ color: '#999999', fontSize: '0.9rem', margin: 0 }}>
                  Zatím nemáš historii využití.
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
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
          color: 'var(--psychocas-primary)',
          fontSize: small ? '0.95rem' : '1.45rem',
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
      <p style={{ color: '#999999', fontSize: '0.75rem', marginTop: 2 }}>{label}</p>
      <p style={{ color: '#b0b0b0', fontSize: '0.72rem', marginTop: 2 }}>{hint}</p>
    </div>
  )
}
