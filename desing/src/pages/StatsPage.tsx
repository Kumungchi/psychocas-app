import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { hasRole } from '@/lib/auth'
import type { StatsFilter } from '@/types'
import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip,
} from 'recharts'
import {
  ArrowLeft, TrendingUp, Users, Tag, Store, Percent, Ticket, Clock3, MapPinned, Layers3,
} from 'lucide-react'

const dayNames = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

const TIME_BUCKETS = [
  { id: 'morning', label: 'Ráno', hint: '06-09' },
  { id: 'midday', label: 'Dopoledne', hint: '10-13' },
  { id: 'afternoon', label: 'Odpoledne', hint: '14-17' },
  { id: 'evening', label: 'Večer', hint: '18-21' },
  { id: 'night', label: 'Noc', hint: '22-05' },
] as const

const CATEGORY_LABELS: Record<string, string> = {
  cafe: 'Kavárny',
  shop: 'Obchody',
  event: 'Akce',
  service: 'Služby',
  other: 'Ostatní',
}

interface DailyRow {
  branch_id: string | null
  partner_id: string | null
  discount_id: string | null
  day: string | null
  total: number | null
}

interface TokenRow {
  id: string
  redeemed_at: string | null
  member_id: string
}

interface DetailedRedemptionRow {
  redeemed_at: string
  branch_id: string
  partner_id: string
}

interface BranchRow {
  id: string
  city: string
  name: string
}

interface PartnerRow {
  id: string
  category: string
}

interface HeatRecord {
  city: string
  hour: number
  category: string
}

interface ChartPoint {
  label: string
  total: number
}

interface HeatCityRow {
  city: string
  total: number
  buckets: Record<string, number>
}

interface RankingRow {
  label: string
  value: number
}

const PERIODS: { value: StatsFilter['period']; label: string }[] = [
  { value: 'day', label: 'Dnes' },
  { value: 'week', label: '7 dní' },
  { value: 'month', label: '30 dní' },
]

function getTimeBucketId(hour: number): string {
  if (hour >= 6 && hour <= 9) return 'morning'
  if (hour >= 10 && hour <= 13) return 'midday'
  if (hour >= 14 && hour <= 17) return 'afternoon'
  if (hour >= 18 && hour <= 21) return 'evening'
  return 'night'
}

export function StatsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [period, setPeriod] = useState<StatsFilter['period']>('week')
  const [rawData, setRawData] = useState<DailyRow[]>([])
  const [heatRecords, setHeatRecords] = useState<HeatRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [topPartner, setTopPartner] = useState<string | null>(null)
  const [topDiscount, setTopDiscount] = useState<string | null>(null)
  const [generatedTokens, setGeneratedTokens] = useState(0)
  const [redeemedTokens, setRedeemedTokens] = useState(0)

  const isAdmin = user ? hasRole(user.role, 'board') : false

  const fetchStats = useCallback(async () => {
    setLoading(true)

    const now = new Date()
    let from: Date
    if (period === 'day') {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (period === 'week') {
      from = new Date(now)
      from.setDate(now.getDate() - 6)
      from.setHours(0, 0, 0, 0)
    } else {
      from = new Date(now)
      from.setDate(now.getDate() - 29)
      from.setHours(0, 0, 0, 0)
    }

    const fromDay = from.toISOString().split('T')[0]
    const fromIso = from.toISOString()

    let redemptionQuery = supabase
      .from('redemptions_daily')
      .select('*')
      .gte('day', fromDay)

    let scopedMemberIds: string[] | null = null
    if (!isAdmin && user) {
      redemptionQuery = redemptionQuery.eq('branch_id', user.branch_id)

      const { data: branchMembers } = await supabase
        .from('members')
        .select('id')
        .eq('branch_id', user.branch_id)
      scopedMemberIds = (branchMembers ?? []).map((m) => m.id)
    }

    const { data: redemptionData } = await redemptionQuery
    const rows = (redemptionData as DailyRow[] | null) ?? []
    setRawData(rows)

    let tokenRows: TokenRow[] = []
    if (isAdmin) {
      const { data: tokensData } = await supabase
        .from('tokens')
        .select('id, redeemed_at, member_id')
        .gte('created_at', fromIso)
      tokenRows = (tokensData as TokenRow[] | null) ?? []
    } else if ((scopedMemberIds?.length ?? 0) > 0) {
      const { data: tokensData } = await supabase
        .from('tokens')
        .select('id, redeemed_at, member_id')
        .gte('created_at', fromIso)
        .in('member_id', scopedMemberIds ?? [])
      tokenRows = (tokensData as TokenRow[] | null) ?? []
    }

    setGeneratedTokens(tokenRows.length)
    setRedeemedTokens(tokenRows.filter((t) => t.redeemed_at !== null).length)

    if (rows.length > 0) {
      const partnerTotals: Record<string, number> = {}
      const discountTotals: Record<string, number> = {}
      for (const r of rows) {
        if (r.partner_id) {
          partnerTotals[r.partner_id] = (partnerTotals[r.partner_id] ?? 0) + Number(r.total ?? 0)
        }
        if (r.discount_id) {
          discountTotals[r.discount_id] = (discountTotals[r.discount_id] ?? 0) + Number(r.total ?? 0)
        }
      }
      const topPId = Object.entries(partnerTotals).sort((a, b) => b[1] - a[1])[0]?.[0]
      const topDId = Object.entries(discountTotals).sort((a, b) => b[1] - a[1])[0]?.[0]

      const [pRes, dRes] = await Promise.all([
        topPId ? supabase.from('partners').select('name').eq('id', topPId).single() : null,
        topDId ? supabase.from('discounts').select('title').eq('id', topDId).single() : null,
      ])
      setTopPartner(pRes?.data?.name ?? null)
      setTopDiscount(dRes?.data?.title ?? null)
    } else {
      setTopPartner(null)
      setTopDiscount(null)
    }

    let detailedQuery = supabase
      .from('redemptions')
      .select('redeemed_at, branch_id, partner_id')
      .gte('redeemed_at', fromIso)

    if (!isAdmin && user) {
      detailedQuery = detailedQuery.eq('branch_id', user.branch_id)
    }

    const { data: detailedData } = await detailedQuery
    const detailedRows = (detailedData as DetailedRedemptionRow[] | null) ?? []

    const uniqueBranchIds = [...new Set(detailedRows.map((r) => r.branch_id))]
    const uniquePartnerIds = [...new Set(detailedRows.map((r) => r.partner_id))]

    let branchRows: BranchRow[] = []
    if (uniqueBranchIds.length > 0) {
      const { data } = await supabase
        .from('branches')
        .select('id, city, name')
        .in('id', uniqueBranchIds)
      branchRows = (data as BranchRow[] | null) ?? []
    }

    let partnerRows: PartnerRow[] = []
    if (uniquePartnerIds.length > 0) {
      const { data } = await supabase
        .from('partners')
        .select('id, category')
        .in('id', uniquePartnerIds)
      partnerRows = (data as PartnerRow[] | null) ?? []
    }

    const cityByBranchId: Record<string, string> = {}
    for (const branch of branchRows) {
      cityByBranchId[branch.id] = branch.city || branch.name
    }
    const categoryByPartnerId: Record<string, string> = {}
    for (const partner of partnerRows) {
      categoryByPartnerId[partner.id] = partner.category ?? 'other'
    }

    const mappedHeatRecords: HeatRecord[] = detailedRows.map((row) => ({
      city: cityByBranchId[row.branch_id] ?? 'Neznámé',
      hour: new Date(row.redeemed_at).getHours(),
      category: categoryByPartnerId[row.partner_id] ?? 'other',
    }))
    setHeatRecords(mappedHeatRecords)
    setLoading(false)
  }, [period, isAdmin, user])

  useEffect(() => { void fetchStats() }, [fetchStats])

  const totalRedemptions = rawData.reduce((sum, row) => sum + Number(row.total ?? 0), 0)
  const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : 30
  const avgPerDay = (totalRedemptions / periodDays).toFixed(1)
  const conversion = generatedTokens > 0 ? ((redeemedTokens / generatedTokens) * 100).toFixed(1) : '0.0'

  const chartData: ChartPoint[] = (() => {
    if (period === 'day') {
      const today = new Date().toISOString().split('T')[0]
      const total = rawData
        .filter((row) => row.day === today)
        .reduce((sum, row) => sum + Number(row.total ?? 0), 0)
      return [{ label: 'Dnes', total }]
    }

    if (period === 'week') {
      const now = new Date()
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now)
        d.setDate(now.getDate() - (6 - i))
        const dayStr = d.toISOString().split('T')[0]
        const dow = d.getDay()
        return {
          label: dow === 0 ? dayNames[6] : dayNames[dow - 1],
          total: rawData
            .filter((row) => row.day === dayStr)
            .reduce((sum, row) => sum + Number(row.total ?? 0), 0),
        }
      })
    }

    const now = new Date()
    return [3, 2, 1, 0].map((w) => {
      const start = new Date(now)
      start.setDate(now.getDate() - w * 7 - 6)
      const end = new Date(now)
      end.setDate(now.getDate() - w * 7)
      return {
        label: w === 0 ? 'Tento týd.' : `${w}. týd.`,
        total: rawData
          .filter((row) => {
            if (!row.day) return false
            const day = new Date(row.day)
            return day >= start && day <= end
          })
          .reduce((sum, row) => sum + Number(row.total ?? 0), 0),
      }
    })
  })()

  const {
    cityRows, maxHeatValue, topHours, categoryRanking,
  } = useMemo(() => {
    const countsByCity: Record<string, Record<string, number>> = {}
    const countsByHour: number[] = new Array(24).fill(0)
    const countsByCategory: Record<string, number> = {}

    for (const record of heatRecords) {
      const bucketId = getTimeBucketId(record.hour)
      if (!countsByCity[record.city]) {
        countsByCity[record.city] = {}
        for (const bucket of TIME_BUCKETS) countsByCity[record.city][bucket.id] = 0
      }
      countsByCity[record.city][bucketId] += 1
      countsByHour[record.hour] += 1
      countsByCategory[record.category] = (countsByCategory[record.category] ?? 0) + 1
    }

    const rankedCities: HeatCityRow[] = Object.entries(countsByCity)
      .map(([city, buckets]) => ({
        city,
        buckets,
        total: Object.values(buckets).reduce((sum, value) => sum + value, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)

    let maxCell = 0
    for (const row of rankedCities) {
      for (const bucket of TIME_BUCKETS) {
        maxCell = Math.max(maxCell, row.buckets[bucket.id] ?? 0)
      }
    }

    const rankedHours: RankingRow[] = countsByHour
      .map((value, hour) => ({ label: `${String(hour).padStart(2, '0')}:00`, value }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)

    const rankedCategories: RankingRow[] = Object.entries(countsByCategory)
      .map(([category, value]) => ({
        label: CATEGORY_LABELS[category] ?? 'Ostatní',
        value,
      }))
      .sort((a, b) => b.value - a.value)

    return {
      cityRows: rankedCities,
      maxHeatValue: maxCell,
      topHours: rankedHours,
      categoryRanking: rankedCategories,
    }
  }, [heatRecords])

  const maxHourValue = topHours[0]?.value ?? 1
  const maxCategoryValue = categoryRanking[0]?.value ?? 1

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
          <h1 style={{ color: 'var(--psychocas-primary)', margin: 0, fontSize: 'clamp(1.2rem, 5vw, 1.5rem)' }}>Analytika</h1>
        </div>
      </header>

      <main style={{ maxWidth: '28rem', margin: '0 auto', padding: 'clamp(1rem, 4vw, 1.5rem)' }} className="space-y-4 fade-in-up pb-8">
        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#ebebeb', borderRadius: '1rem', padding: '0.25rem' }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                flex: 1, padding: '0.5rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer',
                fontWeight: period === p.value ? 600 : 400,
                fontSize: '0.875rem',
                backgroundColor: period === p.value ? 'var(--psychocas-white)' : 'transparent',
                color: period === p.value ? 'var(--psychocas-primary)' : '#888888',
                boxShadow: period === p.value ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="psychocas-card text-center py-12">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--psychocas-primary)' }} />
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <KpiCard icon={<Users className="w-5 h-5" style={{ color: '#049edb' }} />} value={String(totalRedemptions)} label="Celkem ověření" />
              <KpiCard icon={<TrendingUp className="w-5 h-5" style={{ color: '#16a34a' }} />} value={avgPerDay} label="Průměr/den" accent />
              <KpiCard icon={<Ticket className="w-5 h-5" style={{ color: '#ea580c' }} />} value={String(generatedTokens)} label="Tokeny vytvořeny" />
              <KpiCard icon={<Percent className="w-5 h-5" style={{ color: '#7c3aed' }} />} value={`${conversion}%`} label="Konverze tokenů" />
              <KpiCard icon={<Store className="w-5 h-5" style={{ color: '#0ea5e9' }} />} value={topPartner ?? '—'} label="Top partner" small />
              <KpiCard icon={<Tag className="w-5 h-5" style={{ color: '#f59e0b' }} />} value={topDiscount ?? '—'} label="Top sleva" small />
            </div>

            <div className="psychocas-card">
              <p className="font-semibold mb-4" style={{ color: 'var(--psychocas-text-gray)' }}>
                Ověření — {period === 'day' ? 'dnes' : period === 'week' ? 'posledních 7 dní' : 'posledních 30 dní'}
              </p>

              {totalRedemptions === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <TrendingUp className="w-10 h-10 mx-auto" style={{ color: '#cccccc' }} />
                  <p style={{ color: '#666666', fontSize: '0.9rem' }}>Za toto období nejsou data.</p>
                </div>
              ) : (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#999', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#999', fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(4,158,219,0.06)' }}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, fontSize: 13 }}
                        formatter={(value: number) => [value, 'Ověření']}
                      />
                      <Bar dataKey="total" fill="var(--psychocas-primary)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="psychocas-card space-y-4">
              <div className="flex items-center gap-2">
                <MapPinned className="w-4 h-4" style={{ color: 'var(--psychocas-primary)' }} />
                <p className="font-semibold" style={{ color: 'var(--psychocas-text-gray)', margin: 0 }}>
                  Heatmapa benefitů (město × část dne)
                </p>
              </div>

              {cityRows.length === 0 ? (
                <p style={{ color: '#666666', fontSize: '0.9rem' }}>Za zvolené období nejsou detailní data heatmapy.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: 430, display: 'grid', gridTemplateColumns: '120px repeat(5, 1fr)', gap: 6, alignItems: 'center' }}>
                    <div />
                    {TIME_BUCKETS.map((bucket) => (
                      <div key={bucket.id} style={{ textAlign: 'center' }}>
                        <p style={{ margin: 0, color: '#777777', fontSize: '0.72rem', fontWeight: 600 }}>{bucket.label}</p>
                        <p style={{ margin: 0, color: '#b0b0b0', fontSize: '0.68rem' }}>{bucket.hint}</p>
                      </div>
                    ))}

                    {cityRows.map((row) => (
                      <div key={row.city} style={{ display: 'contents' }}>
                        <p style={{ margin: 0, color: '#666666', fontSize: '0.8rem', fontWeight: 600 }}>{row.city}</p>
                        {TIME_BUCKETS.map((bucket) => {
                          const value = row.buckets[bucket.id] ?? 0
                          const intensity = maxHeatValue > 0 ? value / maxHeatValue : 0
                          const background = value === 0
                            ? '#f2f4f7'
                            : `rgba(4, 158, 219, ${0.18 + 0.62 * intensity})`
                          const textColor = intensity > 0.6 ? '#ffffff' : '#1d4f7d'
                          return (
                            <div
                              key={`${row.city}-${bucket.id}`}
                              style={{
                                height: 34,
                                borderRadius: 10,
                                backgroundColor: background,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                color: textColor,
                              }}
                            >
                              {value > 0 ? value : '—'}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="psychocas-card space-y-3">
              <div className="flex items-center gap-2">
                <Clock3 className="w-4 h-4" style={{ color: 'var(--psychocas-primary)' }} />
                <p className="font-semibold" style={{ color: 'var(--psychocas-text-gray)', margin: 0 }}>
                  Nejvytíženější hodiny
                </p>
              </div>
              {topHours.length === 0 ? (
                <p style={{ color: '#666666', fontSize: '0.9rem' }}>Žádná hodinová data za zvolené období.</p>
              ) : (
                topHours.map((entry) => {
                  const width = Math.max(8, Math.round((entry.value / maxHourValue) * 100))
                  return (
                    <div key={entry.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: '#666666', fontSize: '0.85rem' }}>{entry.label}</span>
                        <span style={{ color: '#999999', fontSize: '0.8rem' }}>{entry.value}x</span>
                      </div>
                      <div style={{ backgroundColor: '#eef2f6', borderRadius: 9999, height: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${width}%`, backgroundColor: 'var(--psychocas-primary)', height: '100%' }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="psychocas-card space-y-3">
              <div className="flex items-center gap-2">
                <Layers3 className="w-4 h-4" style={{ color: 'var(--psychocas-primary)' }} />
                <p className="font-semibold" style={{ color: 'var(--psychocas-text-gray)', margin: 0 }}>
                  Typy partnerů v čase
                </p>
              </div>
              {categoryRanking.length === 0 ? (
                <p style={{ color: '#666666', fontSize: '0.9rem' }}>Žádná data kategorií partnerů.</p>
              ) : (
                categoryRanking.map((entry) => {
                  const width = Math.max(8, Math.round((entry.value / maxCategoryValue) * 100))
                  return (
                    <div key={entry.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: '#666666', fontSize: '0.85rem' }}>{entry.label}</span>
                        <span style={{ color: '#999999', fontSize: '0.8rem' }}>{entry.value}x</span>
                      </div>
                      <div style={{ backgroundColor: '#eef2f6', borderRadius: 9999, height: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${width}%`, backgroundColor: 'var(--psychocas-accent)', height: '100%' }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function KpiCard({
  icon, value, label, accent, small,
}: {
  icon: React.ReactNode
  value: string
  label: string
  accent?: boolean
  small?: boolean
}) {
  return (
    <div className="psychocas-card text-center" style={{ padding: '1rem' }}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p
        className="font-bold truncate"
        style={{
          color: accent ? 'var(--psychocas-status-green)' : 'var(--psychocas-primary)',
          fontSize: small ? '0.85rem' : '1.5rem',
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
      <p style={{ color: '#999999', fontSize: '0.75rem', marginTop: 2 }}>{label}</p>
    </div>
  )
}
