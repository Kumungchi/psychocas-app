'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import useMemberContext from '@/hooks/useMemberContext';
import useLocale from '@/hooks/useLocale';
import { hasRole } from '@/lib/auth/membership';
import type { Partner, Discount, PartnerCategory, AuditLogRow, AuditAction } from '@/types/discount';
import {
  ArrowLeft, Plus, Coffee, ShoppingBag, Calendar, Wrench, HelpCircle,
  Pencil, Store, Tag, X, Power, History,
} from 'lucide-react';
import { toast } from 'sonner';

const categoryIcons: Record<PartnerCategory, typeof Coffee> = {
  cafe: Coffee, shop: ShoppingBag, event: Calendar, service: Wrench, other: HelpCircle,
};
const categoryConfig: Record<PartnerCategory, { bg: string; color: string }> = {
  cafe: { bg: '#fff8e1', color: '#f59e0b' },
  shop: { bg: '#f3e8ff', color: '#7c3aed' },
  event: { bg: '#e0f2fe', color: '#0284c7' },
  service: { bg: '#dcfce7', color: '#16a34a' },
  other: { bg: '#f1f5f9', color: '#64748b' },
};

type Tab = 'partners' | 'discounts';
type DiscountRow = Discount & { partner_name?: string };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatValidity(validFrom: string | null, validUntil: string | null, t: (key: string) => string) {
  if (!validFrom && !validUntil) return t('managePage.noValidityLimit');
  if (validFrom && !validUntil) return `${t('managePage.validFrom')} ${new Date(validFrom).toLocaleDateString('cs-CZ')}`;
  if (!validFrom && validUntil) return `${t('managePage.validUntil')} ${new Date(validUntil).toLocaleDateString('cs-CZ')}`;
  return `${new Date(validFrom!).toLocaleDateString('cs-CZ')} – ${new Date(validUntil!).toLocaleDateString('cs-CZ')}`;
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm text-center py-12 space-y-3">
      <div className="flex justify-center">{icon}</div>
      <p className="text-gray-500" style={{ fontSize: '0.9rem' }}>{text}</p>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function BottomSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 40, backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '28rem', zIndex: 50,
        backgroundColor: '#fff', borderRadius: '1.5rem 1.5rem 0 0',
        padding: 'clamp(1.25rem, 5vw, 1.75rem)', boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
        maxHeight: '90dvh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem',
      }}>
        <div style={{ width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 999, margin: '-0.5rem auto 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ color: '#1d4f7d', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X style={{ width: 16, height: 16, color: '#666' }} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

export default function ManagePage() {
  const { member, user, status } = useMemberContext();
  const router = useRouter();
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>('partners');

  const [partners, setPartners] = useState<Partner[]>([]);
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyDiscountId, setBusyDiscountId] = useState<string | null>(null);

  // Partner form
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pCategory, setPCategory] = useState<PartnerCategory>('other');
  const [pAddress, setPAddress] = useState('');
  const [pWebsite, setPWebsite] = useState('');
  const [pBranchId, setPBranchId] = useState<string | null>(null);

  // Discount form
  const [discountOpen, setDiscountOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountRow | null>(null);
  const [dPartnerId, setDPartnerId] = useState('');
  const [dTitle, setDTitle] = useState('');
  const [dValue, setDValue] = useState('');
  const [dDesc, setDDesc] = useState('');
  const [dValidFrom, setDValidFrom] = useState('');
  const [dValidUntil, setDValidUntil] = useState('');
  const [dIsActive, setDIsActive] = useState(true);

  const isAdmin = member ? hasRole(member.role, 'council') : false;
  const canManage = member ? hasRole(member.role, 'manager') : false;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [pRes, dRes, aRes] = await Promise.all([
      supabase.from('partners').select('*').eq('is_active', true).order('name'),
      supabase.from('discounts').select('*, partner:partners(name)').order('created_at', { ascending: false }),
      supabase.from('admin_audit_logs').select('id, action, entity_type, entity_name, created_at, actor:members(full_name)').order('created_at', { ascending: false }).limit(8),
    ]);

    if (pRes.data) setPartners(pRes.data as Partner[]);
    if (dRes.data) {
      setDiscounts(
        (dRes.data as (Discount & { partner: { name: string } | null })[]).map(d => ({
          ...d,
          partner_name: d.partner?.name ?? '—',
        })),
      );
    }
    if (aRes.data) {
      setAuditLogs(
        (aRes.data as unknown as Array<Omit<AuditLogRow, 'actor'> & { actor: { full_name: string }[] | { full_name: string } | null }>).map(row => ({
          ...row,
          actor: Array.isArray(row.actor) ? (row.actor[0] ?? null) : row.actor,
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status !== 'ready' || !canManage) return;
    void fetchData(); // eslint-disable-line react-hooks/set-state-in-effect -- data fetch on mount
  }, [status, canManage, fetchData]);

  function openPartnerForm(partner?: Partner) {
    if (partner) {
      setEditingPartner(partner);
      setPName(partner.name);
      setPDesc(partner.description ?? '');
      setPCategory(partner.category);
      setPAddress(partner.address ?? '');
      setPWebsite(partner.website ?? '');
      setPBranchId(partner.branch_id);
    } else {
      setEditingPartner(null);
      setPName(''); setPDesc(''); setPCategory('other'); setPAddress(''); setPWebsite('');
      setPBranchId(isAdmin ? null : member?.branch_id ?? null);
    }
    setPartnerOpen(true);
  }

  async function savePartner() {
    if (!pName.trim()) { toast.error(t('managePage.errors.nameRequired')); return; }

    const payload = {
      name: pName.trim(), description: pDesc.trim() || null, category: pCategory,
      address: pAddress.trim() || null, website: pWebsite.trim() || null, branch_id: pBranchId, is_active: true,
    };

    if (editingPartner) {
      const { error } = await supabase.from('partners').update(payload).eq('id', editingPartner.id);
      if (error) { toast.error(t('managePage.errors.saveFailed')); return; }
      toast.success(t('managePage.success.partnerUpdated'));
    } else {
      const { error } = await supabase.from('partners').insert(payload);
      if (error) { toast.error(t('managePage.errors.createFailed')); return; }
      toast.success(t('managePage.success.partnerCreated'));
    }
    setPartnerOpen(false);
    await fetchData();
  }

  function openDiscountForm(discount?: DiscountRow) {
    if (discount) {
      setEditingDiscount(discount);
      setDPartnerId(discount.partner_id); setDTitle(discount.title); setDValue(discount.discount_value);
      setDDesc(discount.description ?? ''); setDValidFrom(discount.valid_from ?? '');
      setDValidUntil(discount.valid_until ?? ''); setDIsActive(discount.is_active);
    } else {
      setEditingDiscount(null);
      setDPartnerId(partners[0]?.id ?? ''); setDTitle(''); setDValue(''); setDDesc('');
      setDValidFrom(''); setDValidUntil(''); setDIsActive(true);
    }
    setDiscountOpen(true);
  }

  async function saveDiscount() {
    if (!dTitle.trim() || !dValue.trim() || !dPartnerId) {
      toast.error(t('managePage.errors.discountFields')); return;
    }
    if (!member) return;
    if (dValidFrom && dValidUntil && dValidFrom > dValidUntil) {
      toast.error(t('managePage.errors.dateOrder')); return;
    }

    const payload = {
      partner_id: dPartnerId, title: dTitle.trim(), description: dDesc.trim() || null,
      discount_value: dValue.trim(), valid_from: dValidFrom || null, valid_until: dValidUntil || null, is_active: dIsActive,
    };

    if (editingDiscount) {
      const { error } = await supabase.from('discounts').update(payload).eq('id', editingDiscount.id);
      if (error) { toast.error(t('managePage.errors.editFailed')); return; }
      toast.success(t('managePage.success.discountUpdated'));
    } else {
      const { error } = await supabase.from('discounts').insert({ ...payload, created_by: user?.id ?? '' });
      if (error) { toast.error(t('managePage.errors.discountCreateFailed')); return; }
      toast.success(t('managePage.success.discountCreated'));
    }
    setDiscountOpen(false);
    await fetchData();
  }

  async function toggleDiscountActive(discount: DiscountRow) {
    setBusyDiscountId(discount.id);
    const { error } = await supabase.from('discounts').update({ is_active: !discount.is_active }).eq('id', discount.id);
    setBusyDiscountId(null);
    if (error) { toast.error(t('managePage.errors.toggleFailed')); return; }
    toast.success(discount.is_active ? t('managePage.success.discountDeactivated') : t('managePage.success.discountActivated'));
    await fetchData();
  }

  const activeDiscounts = discounts.filter(d => d.is_active).length;
  const inactiveDiscounts = discounts.length - activeDiscounts;

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200';

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#f5f5f5' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        backgroundColor: 'rgba(245,245,245,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.05)', padding: 'clamp(0.75rem, 3vw, 1rem) clamp(1rem, 4vw, 1.5rem)',
      }}>
        <div style={{ maxWidth: '28rem', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => router.push('/home')} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4f7d', cursor: 'pointer', flexShrink: 0 }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 style={{ color: '#1d4f7d', margin: 0, fontSize: 'clamp(1.2rem, 5vw, 1.5rem)' }}>{t('managePage.title')}</h1>
        </div>

        <div style={{ maxWidth: '28rem', margin: '0.75rem auto 0', display: 'flex', gap: '0.5rem', backgroundColor: '#e8e8e8', borderRadius: '0.875rem', padding: '0.2rem' }}>
          {([['partners', Store, t('managePage.partners')], ['discounts', Tag, t('managePage.discounts')]] as const).map(([tabKey, Icon, label]) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey as Tab)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                padding: '0.5rem', borderRadius: '0.65rem', border: 'none', cursor: 'pointer',
                fontWeight: tab === tabKey ? 600 : 400, fontSize: '0.875rem',
                backgroundColor: tab === tabKey ? '#fff' : 'transparent',
                color: tab === tabKey ? '#1d4f7d' : '#888',
                boxShadow: tab === tabKey ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <Icon style={{ width: 15, height: 15 }} /> {label}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: '28rem', margin: '0 auto', padding: 'clamp(1rem, 4vw, 1.5rem)' }} className="space-y-3 pb-8">
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm text-center py-12">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#1d4f7d' }} />
          </div>
        ) : (
          <>
            <button
              onClick={() => (tab === 'partners' ? openPartnerForm() : openDiscountForm())}
              disabled={tab === 'discounts' && partners.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: '#1d4f7d' }}
            >
              <Plus className="w-5 h-5" />
              {tab === 'partners' ? t('managePage.addPartner') : t('managePage.addDiscount')}
            </button>

            {tab === 'partners' && (
              partners.length === 0 ? (
                <EmptyState icon={<Store className="w-8 h-8 text-gray-300" />} text={t('managePage.noPartners')} />
              ) : (
                <div className="space-y-2">
                  {partners.map(p => {
                    const Icon = categoryIcons[p.category];
                    const cfg = categoryConfig[p.category];
                    return (
                      <div key={p.id} className="bg-white rounded-2xl shadow-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.875rem 1rem' }}>
                        <div style={{ width: 44, height: 44, borderRadius: '0.875rem', backgroundColor: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon style={{ width: 20, height: 20, color: cfg.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="font-semibold text-gray-700 truncate" style={{ fontSize: '0.95rem' }}>{p.name}</p>
                          <p className="text-gray-400" style={{ fontSize: '0.8rem' }}>{t(`categories.${p.category}`)} · {p.branch_id ? t('categories.local') : t('categories.national')}</p>
                        </div>
                        <button onClick={() => openPartnerForm(p)} style={{ background: '#f0f7ff', border: 'none', borderRadius: '0.625rem', padding: '0.5rem', color: '#049edb', cursor: 'pointer', flexShrink: 0 }}>
                          <Pencil style={{ width: 16, height: 16 }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {tab === 'discounts' && (
              partners.length === 0 ? (
                <EmptyState icon={<Store className="w-8 h-8 text-gray-300" />} text={t('managePage.addPartnerFirst')} />
              ) : discounts.length === 0 ? (
                <EmptyState icon={<Tag className="w-8 h-8 text-gray-300" />} text={t('managePage.noDiscounts')} />
              ) : (
                <div className="space-y-2">
                  <div className="bg-white rounded-2xl shadow-sm p-4" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666' }}>
                    <span>{t('managePage.active')}: <strong style={{ color: '#16a34a' }}>{activeDiscounts}</strong></span>
                    <span>{t('managePage.inactive')}: <strong style={{ color: '#dc2626' }}>{inactiveDiscounts}</strong></span>
                  </div>

                  {discounts.map(d => (
                    <div key={d.id} className="bg-white rounded-2xl shadow-sm" style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ minWidth: 0 }}>
                          <p className="text-gray-400" style={{ fontSize: '0.75rem', marginBottom: '0.15rem' }}>{d.partner_name}</p>
                          <p className="font-semibold text-gray-700 truncate" style={{ fontSize: '0.9rem' }}>{d.title}</p>
                        </div>
                        <span style={{ flexShrink: 0, backgroundColor: '#1d4f7d', color: '#fff', fontSize: '0.8rem', fontWeight: 700, padding: '0.3rem 0.75rem', borderRadius: '999px' }}>
                          {d.discount_value}
                        </span>
                      </div>
                      <div style={{ marginTop: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <p className="text-gray-400" style={{ fontSize: '0.76rem' }}>{formatValidity(d.valid_from, d.valid_until, t)}</p>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '999px', color: d.is_active ? '#166534' : '#991b1b', backgroundColor: d.is_active ? '#dcfce7' : '#fee2e2' }}>
                          {d.is_active ? t('managePage.active') : t('managePage.inactive')}
                        </span>
                      </div>
                      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => openDiscountForm(d)} style={{ flex: 1, border: '1px solid #dbeafe', background: '#eff6ff', color: '#1d4f7d', borderRadius: '0.7rem', padding: '0.45rem', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                          <Pencil style={{ width: 14, height: 14 }} /> {t('managePage.edit')}
                        </button>
                        <button
                          onClick={() => void toggleDiscountActive(d)}
                          disabled={busyDiscountId === d.id}
                          style={{ flex: 1, border: d.is_active ? '1px solid #fecaca' : '1px solid #bbf7d0', background: d.is_active ? '#fef2f2' : '#f0fdf4', color: d.is_active ? '#b91c1c' : '#166534', borderRadius: '0.7rem', padding: '0.45rem', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', cursor: 'pointer', opacity: busyDiscountId === d.id ? 0.6 : 1 }}
                        >
                          <Power style={{ width: 14, height: 14 }} />
                          {d.is_active ? t('managePage.deactivate') : t('managePage.activate')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {auditLogs.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <History className="w-4 h-4" style={{ color: '#1d4f7d' }} />
                  <p className="font-bold text-gray-700" style={{ fontSize: '0.92rem' }}>{t('managePage.recentChanges')}</p>
                </div>
                <div className="space-y-2">
                  {auditLogs.map(log => (
                    <div key={log.id} style={{ border: '1px solid #f0f0f0', borderRadius: '0.65rem', padding: '0.55rem 0.7rem' }}>
                      <p className="text-gray-700 font-semibold" style={{ fontSize: '0.8rem' }}>
                        {t(`managePage.audit.${log.entity_type}`)}: {log.entity_name ?? '—'}
                      </p>
                      <p className="text-gray-500" style={{ fontSize: '0.74rem', marginTop: 2 }}>
                        {t(`managePage.audit.${log.action as AuditAction}`)} · {log.actor?.full_name ?? t('managePage.audit.system')} · {formatDateTime(log.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {partnerOpen && (
        <BottomSheet title={editingPartner ? t('managePage.editPartner') : t('managePage.newPartner')} onClose={() => setPartnerOpen(false)}>
          <FormField label={t('managePage.fields.name')}>
            <input className={inputClass} value={pName} onChange={e => setPName(e.target.value)} placeholder={t('managePage.fields.namePlaceholder')} />
          </FormField>
          <FormField label={t('managePage.fields.description')}>
            <input className={inputClass} value={pDesc} onChange={e => setPDesc(e.target.value)} placeholder={t('managePage.fields.descPlaceholder')} />
          </FormField>
          <FormField label={t('managePage.fields.category')}>
            <select className={inputClass} value={pCategory} onChange={e => setPCategory(e.target.value as PartnerCategory)} style={{ appearance: 'auto' }}>
              {(['cafe', 'shop', 'event', 'service', 'other'] as PartnerCategory[]).map(val => (
                <option key={val} value={val}>{t(`categories.${val}`)}</option>
              ))}
            </select>
          </FormField>
          <FormField label={t('managePage.fields.address')}>
            <input className={inputClass} value={pAddress} onChange={e => setPAddress(e.target.value)} placeholder={t('managePage.fields.addressPlaceholder')} />
          </FormField>
          <FormField label={t('managePage.fields.website')}>
            <input className={inputClass} value={pWebsite} onChange={e => setPWebsite(e.target.value)} placeholder="https://..." />
          </FormField>
          {isAdmin && (
            <FormField label={t('managePage.fields.scope')}>
              <select className={inputClass} value={pBranchId ?? 'national'} onChange={e => setPBranchId(e.target.value === 'national' ? null : e.target.value)} style={{ appearance: 'auto' }}>
                <option value="national">{t('managePage.fields.national')}</option>
                <option value={member?.branch_id ?? ''}>{t('managePage.fields.myBranch')}</option>
              </select>
            </FormField>
          )}
          <button onClick={() => void savePartner()} className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-white mt-2" style={{ backgroundColor: '#1d4f7d' }}>
            {editingPartner ? t('managePage.saveChanges') : t('managePage.createPartner')}
          </button>
        </BottomSheet>
      )}

      {discountOpen && (
        <BottomSheet title={editingDiscount ? t('managePage.edit') : t('managePage.newDiscount')} onClose={() => setDiscountOpen(false)}>
          <FormField label={t('managePage.fields.partner')}>
            <select className={inputClass} value={dPartnerId} onChange={e => setDPartnerId(e.target.value)} style={{ appearance: 'auto' }}>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>
          <FormField label={t('managePage.fields.discountName')}>
            <input className={inputClass} value={dTitle} onChange={e => setDTitle(e.target.value)} placeholder={t('managePage.fields.discountNamePlaceholder')} />
          </FormField>
          <FormField label={t('managePage.fields.discountValue')}>
            <input className={inputClass} value={dValue} onChange={e => setDValue(e.target.value)} placeholder={t('managePage.fields.discountValuePlaceholder')} />
          </FormField>
          <FormField label={t('managePage.fields.description')}>
            <input className={inputClass} value={dDesc} onChange={e => setDDesc(e.target.value)} placeholder={t('managePage.fields.discountDescPlaceholder')} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <FormField label={t('managePage.validFromLabel')}>
              <input className={inputClass} type="date" value={dValidFrom} onChange={e => setDValidFrom(e.target.value)} />
            </FormField>
            <FormField label={t('managePage.validUntilLabel')}>
              <input className={inputClass} type="date" value={dValidUntil} onChange={e => setDValidUntil(e.target.value)} />
            </FormField>
          </div>
          {editingDiscount && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={dIsActive} onChange={e => setDIsActive(e.target.checked)} />
              {t('managePage.discountActive')}
            </label>
          )}
          <button onClick={() => void saveDiscount()} className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-white mt-2" style={{ backgroundColor: '#1d4f7d' }}>
            {editingDiscount ? t('managePage.saveChanges') : t('managePage.createDiscount')}
          </button>
        </BottomSheet>
      )}
    </div>
  );
}
