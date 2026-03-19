import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { DiscountWithPartner } from '@/types'
import {
  Coffee, ShoppingBag, Calendar, Wrench, HelpCircle,
  ArrowLeft, Tag, ChevronRight, Globe, MapPin,
} from 'lucide-react'

// Category → icon + colour
const categoryConfig = {
  cafe:    { Icon: Coffee,      bg: '#fff8e1', color: '#f59e0b' },
  shop:    { Icon: ShoppingBag, bg: '#f3e8ff', color: '#7c3aed' },
  event:   { Icon: Calendar,    bg: '#e0f2fe', color: '#0284c7' },
  service: { Icon: Wrench,      bg: '#dcfce7', color: '#16a34a' },
  other:   { Icon: HelpCircle,  bg: '#f1f5f9', color: '#64748b' },
} as const

type Category = keyof typeof categoryConfig

export function DiscountsPage() {
  useAuth()
  const navigate = useNavigate()
  const [discounts, setDiscounts] = useState<DiscountWithPartner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDiscounts() {
      const { data, error } = await supabase
        .from('discounts')
        .select('*, partner:partners(*)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (!error && data) setDiscounts(data as DiscountWithPartner[])
      setLoading(false)
    }
    fetchDiscounts()
  }, [])

  const national = discounts.filter(d => d.partner.branch_id === null)
  const local    = discounts.filter(d => d.partner.branch_id !== null)

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--psychocas-light-gray)' }}>

      {/* ── Sticky header ────────────────────────────── */}
      <header
        className="fade-in-up"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: 'rgba(245,245,245,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          padding: 'clamp(0.75rem, 3vw, 1rem) clamp(1rem, 4vw, 1.5rem)',
        }}
      >
        <div style={{ maxWidth: '28rem', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/')}
            className="interactive-element"
            style={{
              background: 'var(--psychocas-white)',
              border: '1px solid #e0e0e0',
              borderRadius: '50%',
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--psychocas-primary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 style={{ color: 'var(--psychocas-primary)', margin: 0, fontSize: 'clamp(1.2rem, 5vw, 1.5rem)' }}>
            Slevy
          </h1>
          {!loading && (
            <span
              className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#e8f4fd', color: 'var(--psychocas-primary)' }}
            >
              {discounts.length}
            </span>
          )}
        </div>
      </header>

      {/* ── Content ──────────────────────────────────── */}
      <main style={{ maxWidth: '28rem', margin: '0 auto', padding: 'clamp(1rem, 4vw, 1.5rem)' }} className="space-y-5 fade-in-up pb-8">

        {/* Loading */}
        {loading && (
          <div className="psychocas-card text-center py-12">
            <div
              className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto"
              style={{ borderColor: 'var(--psychocas-primary)' }}
            />
            <p className="mt-4" style={{ color: '#666666' }}>Načítání slev...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && discounts.length === 0 && (
          <div className="psychocas-card text-center py-14 space-y-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
              style={{ backgroundColor: '#f5f5f5' }}
            >
              <Tag className="w-8 h-8" style={{ color: '#cccccc' }} />
            </div>
            <p className="font-medium" style={{ color: '#666666' }}>Žádné slevy k dispozici</p>
            <p className="text-sm" style={{ color: '#999999' }}>Nové slevy přidají správci brzy.</p>
          </div>
        )}

        {/* National */}
        {national.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Globe className="w-4 h-4" style={{ color: '#aaaaaa' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#aaaaaa' }}>
                Celostátní slevy
              </span>
            </div>
            <div className="space-y-2">
              {national.map(d => (
                <DiscountCard key={d.id} discount={d} onSelect={() => navigate(`/token/${d.id}`)} />
              ))}
            </div>
          </section>
        )}

        {/* Local */}
        {local.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <MapPin className="w-4 h-4" style={{ color: '#aaaaaa' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#aaaaaa' }}>
                Lokální slevy
              </span>
            </div>
            <div className="space-y-2">
              {local.map(d => (
                <DiscountCard key={d.id} discount={d} onSelect={() => navigate(`/token/${d.id}`)} />
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  )
}

/* ─── Discount card ──────────────────────────────── */
function DiscountCard({ discount, onSelect }: { discount: DiscountWithPartner; onSelect: () => void }) {
  const cat = discount.partner.category as Category
  const cfg = categoryConfig[cat] ?? categoryConfig.other
  const { Icon, bg, color } = cfg

  return (
    <div
      className="psychocas-card cursor-pointer active:scale-[0.98] transition-transform"
      onClick={onSelect}
      style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.875rem 1rem' }}
    >
      {/* Category icon */}
      <div
        className="flex items-center justify-center rounded-2xl flex-shrink-0"
        style={{ width: 46, height: 46, backgroundColor: bg }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate" style={{ color: 'var(--psychocas-text-gray)', fontSize: '0.95rem' }}>
          {discount.partner.name}
        </p>
        <p className="text-sm truncate" style={{ color: '#888888' }}>
          {discount.title}
        </p>
      </div>

      {/* Value + chevron */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <span
          className="px-2.5 py-1 rounded-full text-xs font-bold"
          style={{ backgroundColor: 'var(--psychocas-primary)', color: '#fff', letterSpacing: '0.02em' }}
        >
          {discount.discount_value}
        </span>
        <ChevronRight className="w-4 h-4" style={{ color: '#cccccc' }} />
      </div>
    </div>
  )
}
