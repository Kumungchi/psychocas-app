import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { hasRole } from '@/lib/auth'
import type { Partner, Discount, PartnerCategory } from '@/types'
import {
  ArrowLeft, Plus, Coffee, ShoppingBag, Calendar, Wrench, HelpCircle,
  Pencil, Store, Tag, X, Power, History,
} from 'lucide-react'
import { toast } from 'sonner'

const categoryIcons: Record<PartnerCategory, typeof Coffee> = {
  cafe: Coffee, shop: ShoppingBag, event: Calendar, service: Wrench, other: HelpCircle,
}
const categoryConfig: Record<PartnerCategory, { label: string; bg: string; color: string }> = {
  cafe: { label: 'Kavárna', bg: '#fff8e1', color: '#f59e0b' },
  shop: { label: 'Obchod', bg: '#f3e8ff', color: '#7c3aed' },
  event: { label: 'Akce', bg: '#e0f2fe', color: '#0284c7' },
  service: { label: 'Služba', bg: '#dcfce7', color: '#16a34a' },
  other: { label: 'Jiné', bg: '#f1f5f9', color: '#64748b' },
}

type Tab = 'partners' | 'discounts'
type DiscountRow = Discount & { partner_name?: string }
type AuditAction = 'insert' | 'update' | 'delete' | 'activate' | 'deactivate'
type AuditEntity = 'partner' | 'discount'
type AuditLogRow = {
  id: string
  action: AuditAction
  entity_type: AuditEntity
  entity_name: string | null
  created_at: string
  actor: { full_name: string } | null
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatValidity(validFrom: string | null, validUntil: string | null) {
  if (!validFrom && !validUntil) return 'Bez omezení platnosti'
  if (validFrom && !validUntil) return `Od ${new Date(validFrom).toLocaleDateString('cs-CZ')}`
  if (!validFrom && validUntil) return `Do ${new Date(validUntil).toLocaleDateString('cs-CZ')}`
  return `${new Date(validFrom!).toLocaleDateString('cs-CZ')} – ${new Date(validUntil!).toLocaleDateString('cs-CZ')}`
}

function actionLabel(action: AuditAction) {
  switch (action) {
    case 'insert':
      return 'vytvoření'
    case 'update':
      return 'úprava'
    case 'delete':
      return 'smazání'
    case 'activate':
      return 'aktivace'
    case 'deactivate':
      return 'deaktivace'
    default:
      return action
  }
}

export function ManagePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('partners')

  const [partners, setPartners] = useState<Partner[]>([])
  const [discounts, setDiscounts] = useState<DiscountRow[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyDiscountId, setBusyDiscountId] = useState<string | null>(null)

  // Partner form
  const [partnerOpen, setPartnerOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)
  const [pName, setPName] = useState('')
  const [pDesc, setPDesc] = useState('')
  const [pCategory, setPCategory] = useState<PartnerCategory>('other')
  const [pAddress, setPAddress] = useState('')
  const [pWebsite, setPWebsite] = useState('')
  const [pBranchId, setPBranchId] = useState<string | null>(null)

  // Discount form
  const [discountOpen, setDiscountOpen] = useState(false)
  const [editingDiscount, setEditingDiscount] = useState<DiscountRow | null>(null)
  const [dPartnerId, setDPartnerId] = useState('')
  const [dTitle, setDTitle] = useState('')
  const [dValue, setDValue] = useState('')
  const [dDesc, setDDesc] = useState('')
  const [dValidFrom, setDValidFrom] = useState('')
  const [dValidUntil, setDValidUntil] = useState('')
  const [dIsActive, setDIsActive] = useState(true)

  const isAdmin = user ? hasRole(user.role, 'board') : false

  useEffect(() => { void fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [pRes, dRes, aRes] = await Promise.all([
      supabase.from('partners').select('*').eq('is_active', true).order('name'),
      supabase
        .from('discounts')
        .select('*, partner:partners(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('admin_audit_logs')
        .select('id, action, entity_type, entity_name, created_at, actor:members(full_name)')
        .order('created_at', { ascending: false })
        .limit(8),
    ])

    if (pRes.data) setPartners(pRes.data as Partner[])

    if (dRes.data) {
      setDiscounts(
        (dRes.data as (Discount & { partner: { name: string } | null })[]).map(d => ({
          ...d,
          partner_name: d.partner?.name ?? '—',
        })),
      )
    }

    if (aRes.data) {
      setAuditLogs(aRes.data as AuditLogRow[])
    }

    setLoading(false)
  }

  function openPartnerForm(partner?: Partner) {
    if (partner) {
      setEditingPartner(partner)
      setPName(partner.name)
      setPDesc(partner.description ?? '')
      setPCategory(partner.category)
      setPAddress(partner.address ?? '')
      setPWebsite(partner.website ?? '')
      setPBranchId(partner.branch_id)
    } else {
      setEditingPartner(null)
      setPName('')
      setPDesc('')
      setPCategory('other')
      setPAddress('')
      setPWebsite('')
      setPBranchId(isAdmin ? null : user?.branch_id ?? null)
    }
    setPartnerOpen(true)
  }

  async function savePartner() {
    if (!pName.trim()) {
      toast.error('Zadejte název partnera')
      return
    }

    const payload = {
      name: pName.trim(),
      description: pDesc.trim() || null,
      category: pCategory,
      address: pAddress.trim() || null,
      website: pWebsite.trim() || null,
      branch_id: pBranchId,
      is_active: true,
    }

    if (editingPartner) {
      const { error } = await supabase.from('partners').update(payload).eq('id', editingPartner.id)
      if (error) {
        toast.error('Chyba při ukládání partnera')
        return
      }
      toast.success('Partner aktualizován')
    } else {
      const { error } = await supabase.from('partners').insert(payload)
      if (error) {
        toast.error('Chyba při vytváření partnera')
        return
      }
      toast.success('Partner vytvořen')
    }

    setPartnerOpen(false)
    await fetchData()
  }

  function openDiscountForm(discount?: DiscountRow) {
    if (discount) {
      setEditingDiscount(discount)
      setDPartnerId(discount.partner_id)
      setDTitle(discount.title)
      setDValue(discount.discount_value)
      setDDesc(discount.description ?? '')
      setDValidFrom(discount.valid_from ?? '')
      setDValidUntil(discount.valid_until ?? '')
      setDIsActive(discount.is_active)
    } else {
      setEditingDiscount(null)
      setDPartnerId(partners[0]?.id ?? '')
      setDTitle('')
      setDValue('')
      setDDesc('')
      setDValidFrom('')
      setDValidUntil('')
      setDIsActive(true)
    }
    setDiscountOpen(true)
  }

  async function saveDiscount() {
    if (!dTitle.trim() || !dValue.trim() || !dPartnerId) {
      toast.error('Vyplňte název, hodnotu a partnera')
      return
    }
    if (!user) return

    if (dValidFrom && dValidUntil && dValidFrom > dValidUntil) {
      toast.error('Datum "Od" musí být dříve než "Do"')
      return
    }

    const payload = {
      partner_id: dPartnerId,
      title: dTitle.trim(),
      description: dDesc.trim() || null,
      discount_value: dValue.trim(),
      valid_from: dValidFrom || null,
      valid_until: dValidUntil || null,
      is_active: dIsActive,
    }

    if (editingDiscount) {
      const { error } = await supabase.from('discounts').update(payload).eq('id', editingDiscount.id)
      if (error) {
        toast.error('Chyba při úpravě slevy')
        return
      }
      toast.success('Sleva upravena')
    } else {
      const { error } = await supabase.from('discounts').insert({
        ...payload,
        created_by: user.id,
      })
      if (error) {
        toast.error('Chyba při vytváření slevy')
        return
      }
      toast.success('Sleva vytvořena')
    }

    setDiscountOpen(false)
    await fetchData()
  }

  async function toggleDiscountActive(discount: DiscountRow) {
    setBusyDiscountId(discount.id)
    const { error } = await supabase
      .from('discounts')
      .update({ is_active: !discount.is_active })
      .eq('id', discount.id)
    setBusyDiscountId(null)

    if (error) {
      toast.error('Změna stavu slevy selhala')
      return
    }

    toast.success(discount.is_active ? 'Sleva deaktivována' : 'Sleva aktivována')
    await fetchData()
  }

  const activeDiscounts = discounts.filter(d => d.is_active).length
  const inactiveDiscounts = discounts.length - activeDiscounts

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
          <h1 style={{ color: 'var(--psychocas-primary)', margin: 0, fontSize: 'clamp(1.2rem, 5vw, 1.5rem)' }}>Správa</h1>
        </div>

        <div style={{ maxWidth: '28rem', margin: '0.75rem auto 0', display: 'flex', gap: '0.5rem', backgroundColor: '#e8e8e8', borderRadius: '0.875rem', padding: '0.2rem' }}>
          {([['partners', Store, 'Partneři'], ['discounts', Tag, 'Slevy']] as const).map(([t, Icon, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                padding: '0.5rem', borderRadius: '0.65rem', border: 'none', cursor: 'pointer',
                fontWeight: tab === t ? 600 : 400, fontSize: '0.875rem',
                backgroundColor: tab === t ? 'var(--psychocas-white)' : 'transparent',
                color: tab === t ? 'var(--psychocas-primary)' : '#888888',
                boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <Icon style={{ width: 15, height: 15 }} /> {label}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: '28rem', margin: '0 auto', padding: 'clamp(1rem, 4vw, 1.5rem)' }} className="space-y-3 fade-in-up pb-8">
        {loading ? (
          <div className="psychocas-card text-center py-12">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--psychocas-primary)' }} />
          </div>
        ) : (
          <>
            <button
              onClick={() => (tab === 'partners' ? openPartnerForm() : openDiscountForm())}
              disabled={tab === 'discounts' && partners.length === 0}
              className="psychocas-button-primary w-full"
            >
              <Plus className="w-5 h-5" />
              {tab === 'partners' ? 'Přidat partnera' : 'Přidat slevu'}
            </button>

            {tab === 'partners' && (
              partners.length === 0 ? (
                <EmptyState icon={<Store className="w-8 h-8" style={{ color: '#cccccc' }} />} text="Zatím žádní partneři." />
              ) : (
                <div className="space-y-2">
                  {partners.map(p => {
                    const Icon = categoryIcons[p.category]
                    const cfg = categoryConfig[p.category]
                    return (
                      <div key={p.id} className="psychocas-card" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.875rem 1rem' }}>
                        <div style={{ width: 44, height: 44, borderRadius: '0.875rem', backgroundColor: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon style={{ width: 20, height: 20, color: cfg.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, color: 'var(--psychocas-text-gray)', fontSize: '0.95rem' }} className="truncate">{p.name}</p>
                          <p style={{ color: '#999999', fontSize: '0.8rem' }}>{cfg.label} · {p.branch_id ? 'lokální' : 'celostátní'}</p>
                        </div>
                        <button
                          onClick={() => openPartnerForm(p)}
                          style={{ background: '#f0f7ff', border: 'none', borderRadius: '0.625rem', padding: '0.5rem', color: 'var(--psychocas-accent)', cursor: 'pointer', flexShrink: 0 }}
                        >
                          <Pencil style={{ width: 16, height: 16 }} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {tab === 'discounts' && (
              partners.length === 0 ? (
                <EmptyState icon={<Store className="w-8 h-8" style={{ color: '#cccccc' }} />} text="Nejprve přidejte partnera." />
              ) : discounts.length === 0 ? (
                <EmptyState icon={<Tag className="w-8 h-8" style={{ color: '#cccccc' }} />} text="Zatím žádné slevy." />
              ) : (
                <div className="space-y-2">
                  <div className="psychocas-card" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666666' }}>
                    <span>Aktivní: <strong style={{ color: '#16a34a' }}>{activeDiscounts}</strong></span>
                    <span>Neaktivní: <strong style={{ color: '#dc2626' }}>{inactiveDiscounts}</strong></span>
                  </div>

                  {discounts.map(d => (
                    <div key={d.id} className="psychocas-card" style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: '#bbbbbb', fontSize: '0.75rem', marginBottom: '0.15rem' }}>{d.partner_name}</p>
                          <p style={{ fontWeight: 600, color: 'var(--psychocas-text-gray)', fontSize: '0.9rem' }} className="truncate">{d.title}</p>
                        </div>
                        <span style={{ flexShrink: 0, backgroundColor: 'var(--psychocas-primary)', color: '#fff', fontSize: '0.8rem', fontWeight: 700, padding: '0.3rem 0.75rem', borderRadius: '999px' }}>
                          {d.discount_value}
                        </span>
                      </div>

                      <div style={{ marginTop: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <p style={{ color: '#888888', fontSize: '0.76rem' }}>{formatValidity(d.valid_from, d.valid_until)}</p>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '999px',
                            color: d.is_active ? '#166534' : '#991b1b',
                            backgroundColor: d.is_active ? '#dcfce7' : '#fee2e2',
                          }}
                        >
                          {d.is_active ? 'Aktivní' : 'Neaktivní'}
                        </span>
                      </div>

                      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => openDiscountForm(d)}
                          style={{
                            flex: 1,
                            border: '1px solid #dbeafe',
                            background: '#eff6ff',
                            color: '#1d4f7d',
                            borderRadius: '0.7rem',
                            padding: '0.45rem',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            cursor: 'pointer',
                          }}
                        >
                          <Pencil style={{ width: 14, height: 14 }} /> Upravit
                        </button>
                        <button
                          onClick={() => void toggleDiscountActive(d)}
                          disabled={busyDiscountId === d.id}
                          style={{
                            flex: 1,
                            border: d.is_active ? '1px solid #fecaca' : '1px solid #bbf7d0',
                            background: d.is_active ? '#fef2f2' : '#f0fdf4',
                            color: d.is_active ? '#b91c1c' : '#166534',
                            borderRadius: '0.7rem',
                            padding: '0.45rem',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            cursor: 'pointer',
                            opacity: busyDiscountId === d.id ? 0.6 : 1,
                          }}
                        >
                          <Power style={{ width: 14, height: 14 }} />
                          {d.is_active ? 'Deaktivovat' : 'Aktivovat'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {auditLogs.length > 0 && (
              <div className="psychocas-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <History className="w-4 h-4" style={{ color: 'var(--psychocas-primary)' }} />
                  <p style={{ fontWeight: 700, color: 'var(--psychocas-text-gray)', fontSize: '0.92rem' }}>Poslední změny</p>
                </div>
                <div className="space-y-2">
                  {auditLogs.map(log => (
                    <div key={log.id} style={{ border: '1px solid #f0f0f0', borderRadius: '0.65rem', padding: '0.55rem 0.7rem' }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--psychocas-text-gray)', fontWeight: 600 }}>
                        {log.entity_type === 'discount' ? 'Sleva' : 'Partner'}: {log.entity_name ?? '—'}
                      </p>
                      <p style={{ fontSize: '0.74rem', color: '#777777', marginTop: 2 }}>
                        {actionLabel(log.action)} · {log.actor?.full_name ?? 'systém'} · {formatDateTime(log.created_at)}
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
        <BottomSheet title={editingPartner ? 'Upravit partnera' : 'Nový partner'} onClose={() => setPartnerOpen(false)}>
          <FormField label="Název *">
            <input className="psychocas-input" value={pName} onChange={e => setPName(e.target.value)} placeholder="Café Molo" />
          </FormField>
          <FormField label="Popis">
            <input className="psychocas-input" value={pDesc} onChange={e => setPDesc(e.target.value)} placeholder="Útulná kavárna..." />
          </FormField>
          <FormField label="Kategorie">
            <select
              className="psychocas-input"
              value={pCategory}
              onChange={e => setPCategory(e.target.value as PartnerCategory)}
              style={{ appearance: 'auto' }}
            >
              {Object.entries(categoryConfig).map(([val, cfg]) => (
                <option key={val} value={val}>{cfg.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Adresa">
            <input className="psychocas-input" value={pAddress} onChange={e => setPAddress(e.target.value)} placeholder="Náplavka 2, Praha" />
          </FormField>
          <FormField label="Web">
            <input className="psychocas-input" value={pWebsite} onChange={e => setPWebsite(e.target.value)} placeholder="https://..." />
          </FormField>
          {isAdmin && (
            <FormField label="Rozsah">
              <select className="psychocas-input" value={pBranchId ?? 'national'} onChange={e => setPBranchId(e.target.value === 'national' ? null : e.target.value)} style={{ appearance: 'auto' }}>
                <option value="national">Celostátní</option>
                <option value={user?.branch_id ?? ''}>Moje pobočka</option>
              </select>
            </FormField>
          )}
          <button onClick={() => void savePartner()} className="psychocas-button-primary w-full mt-2">
            {editingPartner ? 'Uložit změny' : 'Vytvořit partnera'}
          </button>
        </BottomSheet>
      )}

      {discountOpen && (
        <BottomSheet title={editingDiscount ? 'Upravit slevu' : 'Nová sleva'} onClose={() => setDiscountOpen(false)}>
          <FormField label="Partner *">
            <select className="psychocas-input" value={dPartnerId} onChange={e => setDPartnerId(e.target.value)} style={{ appearance: 'auto' }}>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>
          <FormField label="Název slevy *">
            <input className="psychocas-input" value={dTitle} onChange={e => setDTitle(e.target.value)} placeholder="15 % na všechny nápoje" />
          </FormField>
          <FormField label="Hodnota slevy *">
            <input className="psychocas-input" value={dValue} onChange={e => setDValue(e.target.value)} placeholder="15 %, zdarma, 2+1..." />
          </FormField>
          <FormField label="Popis">
            <input className="psychocas-input" value={dDesc} onChange={e => setDDesc(e.target.value)} placeholder="Platí pro všechny členy..." />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <FormField label="Platné od">
              <input className="psychocas-input" type="date" value={dValidFrom} onChange={e => setDValidFrom(e.target.value)} />
            </FormField>
            <FormField label="Platné do">
              <input className="psychocas-input" type="date" value={dValidUntil} onChange={e => setDValidUntil(e.target.value)} />
            </FormField>
          </div>
          {editingDiscount && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.84rem', color: 'var(--psychocas-text-gray)' }}>
              <input type="checkbox" checked={dIsActive} onChange={e => setDIsActive(e.target.checked)} />
              Sleva aktivní
            </label>
          )}
          <button onClick={() => void saveDiscount()} className="psychocas-button-primary w-full mt-2">
            {editingDiscount ? 'Uložit změny' : 'Vytvořit slevu'}
          </button>
        </BottomSheet>
      )}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="psychocas-card text-center py-12 space-y-3">
      <div className="flex justify-center">{icon}</div>
      <p style={{ color: '#666666', fontSize: '0.9rem' }}>{text}</p>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--psychocas-text-gray)' }}>{label}</label>
      {children}
    </div>
  )
}

function BottomSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 40, backdropFilter: 'blur(4px)' }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '28rem', zIndex: 50,
        backgroundColor: 'var(--psychocas-white)',
        borderRadius: '1.5rem 1.5rem 0 0',
        padding: 'clamp(1.25rem, 5vw, 1.75rem)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
        maxHeight: '90dvh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }}>
        <div style={{ width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 999, margin: '-0.5rem auto 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ color: 'var(--psychocas-primary)', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X style={{ width: 16, height: 16, color: '#666' }} />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}
