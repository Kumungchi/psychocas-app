'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import useMemberContext from '@/hooks/useMemberContext';
import useLocale from '@/hooks/useLocale';
import type { DiscountWithPartner, PartnerCategory } from '@/types/discount';
import {
  Coffee, ShoppingBag, Calendar, Wrench, HelpCircle,
  ArrowLeft, Tag, ChevronRight, Globe, MapPin,
} from 'lucide-react';

const categoryConfig: Record<PartnerCategory, { Icon: typeof Coffee; bg: string; color: string }> = {
  cafe:    { Icon: Coffee,      bg: '#fff8e1', color: '#f59e0b' },
  shop:    { Icon: ShoppingBag, bg: '#f3e8ff', color: '#7c3aed' },
  event:   { Icon: Calendar,    bg: '#e0f2fe', color: '#0284c7' },
  service: { Icon: Wrench,      bg: '#dcfce7', color: '#16a34a' },
  other:   { Icon: HelpCircle,  bg: '#f1f5f9', color: '#64748b' },
};

function DiscountCard({ discount, onSelect }: { discount: DiscountWithPartner; onSelect: () => void }) {
  const cat = (discount.partner.category as PartnerCategory) || 'other';
  const cfg = categoryConfig[cat] ?? categoryConfig.other;
  const { Icon, bg, color } = cfg;

  return (
    <div
      className="bg-white rounded-2xl shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
      onClick={onSelect}
      style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.875rem 1rem' }}
    >
      <div
        className="flex items-center justify-center rounded-2xl flex-shrink-0"
        style={{ width: 46, height: 46, backgroundColor: bg }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate text-gray-700" style={{ fontSize: '0.95rem' }}>
          {discount.partner.name}
        </p>
        <p className="text-sm truncate text-gray-400">
          {discount.title}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#1d4f7d' }}>
          {discount.discount_value}
        </span>
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </div>
    </div>
  );
}

export default function DiscountsPage() {
  const router = useRouter();
  const { status } = useMemberContext();
  const { t } = useLocale();
  const [discounts, setDiscounts] = useState<DiscountWithPartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== 'ready') return;
    async function fetchDiscounts() {
      const { data, error } = await supabase
        .from('discounts')
        .select('*, partner:partners(*)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!error && data) setDiscounts(data as DiscountWithPartner[]);
      setLoading(false);
    }
     
    void fetchDiscounts();
  }, [status]);

  const national = discounts.filter(d => d.partner.branch_id === null);
  const local = discounts.filter(d => d.partner.branch_id !== null);

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#f5f5f5' }}>
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 20,
          backgroundColor: 'rgba(245,245,245,0.92)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          padding: 'clamp(0.75rem, 3vw, 1rem) clamp(1rem, 4vw, 1.5rem)',
        }}
      >
        <div style={{ maxWidth: '28rem', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => router.push('/home')}
            style={{
              background: '#fff', border: '1px solid #e0e0e0', borderRadius: '50%',
              width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#1d4f7d', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 style={{ color: '#1d4f7d', margin: 0, fontSize: 'clamp(1.2rem, 5vw, 1.5rem)' }}>
            {t('discountsPage.title')}
          </h1>
          {!loading && (
            <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#e8f4fd', color: '#1d4f7d' }}>
              {discounts.length}
            </span>
          )}
        </div>
      </header>

      <main style={{ maxWidth: '28rem', margin: '0 auto', padding: 'clamp(1rem, 4vw, 1.5rem)' }} className="space-y-5 pb-8">
        {loading && (
          <div className="bg-white rounded-2xl shadow-sm text-center py-12">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#1d4f7d' }} />
            <p className="mt-4 text-gray-500">{t('discountsPage.loading')}</p>
          </div>
        )}

        {!loading && discounts.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm text-center py-14 space-y-3">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto bg-gray-100">
              <Tag className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-medium text-gray-500">{t('discountsPage.empty')}</p>
            <p className="text-sm text-gray-400">{t('discountsPage.emptyNote')}</p>
          </div>
        )}

        {national.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Globe className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t('discountsPage.national')}
              </span>
            </div>
            <div className="space-y-2">
              {national.map(d => (
                <DiscountCard key={d.id} discount={d} onSelect={() => router.push(`/token/${d.id}`)} />
              ))}
            </div>
          </section>
        )}

        {local.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t('discountsPage.local')}
              </span>
            </div>
            <div className="space-y-2">
              {local.map(d => (
                <DiscountCard key={d.id} discount={d} onSelect={() => router.push(`/token/${d.id}`)} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
