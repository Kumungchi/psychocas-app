'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  BellRing,
  CalendarDays,
  Check,
  ClipboardCheck,
  Globe2,
  Loader2,
  MapPin,
  Megaphone,
  Pause,
  Plus,
  RefreshCcw,
  Save,
  Send,
  Store,
  Tags,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import PsychocasLogo from '@/components/PsychocasLogo';
import useLocale from '@/hooks/useLocale';
import { getDateLocale } from '@/lib/i18n/utils';
import { colors, radii, shadows } from '@/ui/theme';

type WorkspaceTab = 'support' | 'partners' | 'offers' | 'campaigns' | 'events' | 'approvals' | 'metrics' | 'privacy';
type Scope = 'national' | 'local';
type PartnerCategory = 'cafe' | 'shop' | 'publisher' | 'practice' | 'event' | 'service' | 'other';
type OfferStatus = 'draft' | 'pending_approval' | 'published' | 'active' | 'paused' | 'archived';

const categoryLabels: Record<PartnerCategory, string> = {
  cafe: 'Kavárna',
  shop: 'Obchod',
  publisher: 'Nakladatelství',
  practice: 'Praxe',
  event: 'Událost',
  service: 'Služba',
  other: 'Ostatní',
};

function fieldStyle(): React.CSSProperties {
  return {
    minHeight: 44,
    width: '100%',
    border: `1px solid ${colors.border}`,
    borderRadius: radii.md,
    background: colors.background,
    color: colors.textPrimary,
    padding: '0.65rem 0.75rem',
    fontSize: '1rem',
  };
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`border bg-white ${className}`} style={{ borderColor: colors.border, borderRadius: radii.md, boxShadow: shadows.sm }}>{children}</section>;
}

function statusLabel(status: OfferStatus): string {
  return {
    draft: 'Draft',
    pending_approval: 'Čeká na schválení',
    published: 'Publikováno',
    active: 'Publikováno',
    paused: 'Pozastaveno',
    archived: 'Archivováno',
  }[status];
}

function workflowStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    scheduled: 'Naplánováno',
    active: 'Aktivní',
    completed: 'Dokončená',
    cancelled: 'Zrušená',
    submitted: 'Odesláno',
    in_review: 'V posouzení',
    rejected: 'Zamítnuto',
  };
  return labels[status] ?? status;
}

function privacyTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    access: 'Přístup k údajům',
    correction: 'Oprava údajů',
    deletion: 'Žádost o výmaz',
    restriction: 'Omezení zpracování',
    objection: 'Námitka',
  };
  return labels[type] ?? type;
}

export default function ConvexWorkspace() {
  const router = useRouter();
  const { locale, tr } = useLocale();
  const viewer = useQuery(api.members.viewer);
  const ensureIam = useMutation(api.iam.ensureBootstrap);
  const [iamReady, setIamReady] = useState(false);
  const bootstrappedRef = useRef(false);
  const access = useQuery(api.iam.viewerAccess, viewer?.status === 'ready' && iamReady ? {} : 'skip');
  const branches = useQuery(api.branches.listActive, viewer?.status === 'ready' && iamReady ? {} : 'skip');
  const organizations = useQuery(api.iam.listOrganizations, viewer?.status === 'ready' && iamReady ? {} : 'skip');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('partners');
  const [scope, setScope] = useState<Scope>('national');
  const [branchId, setBranchId] = useState<Id<'branches'> | ''>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [directorySearch, setDirectorySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ name: '', category: 'other' as PartnerCategory, website: '', description: '' });
  const [offerForm, setOfferForm] = useState({ partnerId: '' as Id<'partners'> | '', title: '', value: '', description: '', validFrom: '', validUntil: '' });
  const [campaignForm, setCampaignForm] = useState({ title: '', description: '', validFrom: '', validUntil: '' });
  const [eventForm, setEventForm] = useState({ title: '', description: '', location: '', capacity: '', startsAt: '', endsAt: '' });
  const [selectedEventId, setSelectedEventId] = useState<Id<'events'> | ''>('');
  const [eventCheckInSearch, setEventCheckInSearch] = useState('');

  useEffect(() => {
    if (viewer?.status !== 'ready' || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    void ensureIam().then(() => setIamReady(true)).catch(() => setMessage({ type: 'error', text: 'Pracovní prostor se nepodařilo připravit.' }));
  }, [ensureIam, viewer]);

  const capabilitySet = useMemo(() => new Set(access?.capabilities ?? []), [access]);
  const relevantAssignments = access?.assignments ?? [];
  const canNational =
    relevantAssignments.some((assignment) => assignment.scope === 'organization') ||
    viewer?.status === 'ready' && (viewer.member.role === 'board' || viewer.member.role === 'admin');
  const assignedBranchIds = relevantAssignments
    .filter((assignment) => assignment.scope === 'branch' && assignment.branchId)
    .map((assignment) => assignment.branchId as Id<'branches'>);
  const availableBranches = (branches ?? []).filter(
    (branch) => canNational || assignedBranchIds.includes(branch.id),
  );

  useEffect(() => {
    if (!access) return;
    if (!canNational && availableBranches.length > 0) {
      setScope('local');
      setBranchId((current) => current || availableBranches[0].id);
    }
  }, [access, availableBranches, canNational]);

  const queryScopeReady = scope === 'national' || Boolean(branchId);
  const scopeArgs = queryScopeReady
    ? { scope, branchId: scope === 'local' ? (branchId as Id<'branches'>) : undefined }
    : null;
  const canDraftPartner = capabilitySet.has('partner.draft');
  const canApprovePartner = capabilitySet.has('partner.approve');
  const canDraftOffer = capabilitySet.has('offer.draft');
  const canPublishOffer = capabilitySet.has('offer.publish');
  const canDraftCampaign = capabilitySet.has('campaign.draft');
  const canSendCampaign = capabilitySet.has('campaign.send');
  const canManageEvents = capabilitySet.has('event.manage');
  const canCheckIn = capabilitySet.has('event.check_in');
  const canReadMetrics = capabilitySet.has('metrics.read');
  const canReadDirectory = capabilitySet.has('support.read') || capabilitySet.has('membership.read');
  const canManagePrivacy = capabilitySet.has('privacy.manage');

  const partners = useQuery(
    api.partners.listForManagement,
    canDraftPartner && scopeArgs ? { ...scopeArgs, includeInactive: true } : 'skip',
  );
  const offers = useQuery(
    api.offers.listForManagement,
    canDraftOffer && scopeArgs ? scopeArgs : 'skip',
  );
  const approvals = useQuery(
    api.approvals.list,
    canPublishOffer && scopeArgs ? { ...scopeArgs, includeResolved: false } : 'skip',
  );
  const metrics = useQuery(
    api.analytics.summary,
    canReadMetrics && scopeArgs ? scopeArgs : 'skip',
  );
  const directory = useQuery(
    api.support.directory,
    canReadDirectory && directorySearch.trim().length >= 2
      ? { search: directorySearch, branchId: scope === 'local' ? (branchId as Id<'branches'>) : undefined }
      : 'skip',
  );
  const privacyRequests = useQuery(
    api.privacy.listRequests,
    canManagePrivacy ? {} : 'skip',
  );
  const campaigns = useQuery(
    api.campaigns.listForManagement,
    canDraftCampaign && scopeArgs ? scopeArgs : 'skip',
  );
  const events = useQuery(
    api.events.listForManagement,
    canManageEvents && scopeArgs ? scopeArgs : 'skip',
  );
  const eventCandidates = useQuery(
    api.events.eligibleMembers,
    canCheckIn && selectedEventId && eventCheckInSearch.trim().length >= 2
      ? { eventId: selectedEventId, search: eventCheckInSearch }
      : 'skip',
  );
  const upsertPartner = useMutation(api.partners.upsert);
  const setPartnerActive = useMutation(api.partners.setActive);
  const upsertOffer = useMutation(api.offers.upsertDraft);
  const submitOffer = useMutation(api.offers.submitForApproval);
  const reviewOffer = useMutation(api.offers.review);
  const setOfferPaused = useMutation(api.offers.setPaused);
  const resolvePrivacyRequest = useMutation(api.privacy.resolveRequest);
  const upsertCampaign = useMutation(api.campaigns.upsertDraft);
  const publishCampaign = useMutation(api.campaigns.publish);
  const queueCampaign = useMutation(api.notifications.queueCampaign);
  const upsertEvent = useMutation(api.events.upsertDraft);
  const publishEvent = useMutation(api.events.publish);
  const checkInMember = useMutation(api.events.checkIn);

  useEffect(() => {
    if (!offerForm.partnerId && partners?.length) {
      setOfferForm((current) => ({ ...current, partnerId: partners[0].id }));
    }
  }, [offerForm.partnerId, partners]);

  useEffect(() => {
    if (!selectedEventId && events?.length) setSelectedEventId(events[0]._id);
  }, [events, selectedEventId]);

  const handlePartnerSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!scopeArgs) return;
    setSaving(true);
    setMessage(null);
    try {
      await upsertPartner({
        name: partnerForm.name,
        category: partnerForm.category,
        website: partnerForm.website || undefined,
        description: partnerForm.description || undefined,
        ...scopeArgs,
      });
      setPartnerForm({ name: '', category: 'other', website: '', description: '' });
      setMessage({ type: 'success', text: 'Partner byl uložen.' });
    } catch {
      setMessage({ type: 'error', text: 'Partnera se nepodařilo uložit. Zkontroluj scope a údaje.' });
    } finally {
      setSaving(false);
    }
  };

  const handleOfferSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!scopeArgs || !offerForm.partnerId) return;
    setSaving(true);
    setMessage(null);
    try {
      await upsertOffer({
        partnerId: offerForm.partnerId,
        title: offerForm.title,
        value: offerForm.value,
        description: offerForm.description || undefined,
        validFrom: offerForm.validFrom ? new Date(`${offerForm.validFrom}T00:00:00`).getTime() : undefined,
        validUntil: offerForm.validUntil ? new Date(`${offerForm.validUntil}T23:59:59`).getTime() : undefined,
        ...scopeArgs,
      });
      setOfferForm((current) => ({ ...current, title: '', value: '', description: '', validFrom: '', validUntil: '' }));
      setMessage({ type: 'success', text: 'Draft nabídky byl uložen.' });
    } catch {
      setMessage({ type: 'error', text: 'Nabídku se nepodařilo uložit. Zkontroluj partnera, termín a scope.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCampaignSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!scopeArgs) return;
    setSaving(true);
    setMessage(null);
    try {
      await upsertCampaign({
        ...scopeArgs,
        title: campaignForm.title,
        description: campaignForm.description || undefined,
        validFrom: campaignForm.validFrom ? new Date(campaignForm.validFrom).getTime() : undefined,
        validUntil: campaignForm.validUntil ? new Date(campaignForm.validUntil).getTime() : undefined,
      });
      setCampaignForm({ title: '', description: '', validFrom: '', validUntil: '' });
      setMessage({ type: 'success', text: 'Draft kampaně byl uložen.' });
    } catch {
      setMessage({ type: 'error', text: 'Kampaň se nepodařilo uložit. Zkontroluj termíny a scope.' });
    } finally {
      setSaving(false);
    }
  };

  const handleEventSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!scopeArgs || !eventForm.startsAt) return;
    setSaving(true);
    setMessage(null);
    try {
      await upsertEvent({
        ...scopeArgs,
        title: eventForm.title,
        description: eventForm.description || undefined,
        location: eventForm.location || undefined,
        capacity: eventForm.capacity ? Number(eventForm.capacity) : undefined,
        startsAt: new Date(eventForm.startsAt).getTime(),
        endsAt: eventForm.endsAt ? new Date(eventForm.endsAt).getTime() : undefined,
      });
      setEventForm({ title: '', description: '', location: '', capacity: '', startsAt: '', endsAt: '' });
      setMessage({ type: 'success', text: 'Draft události byl uložen.' });
    } catch {
      setMessage({ type: 'error', text: 'Událost se nepodařilo uložit. Zkontroluj termín, kapacitu a scope.' });
    } finally {
      setSaving(false);
    }
  };

  if (!viewer || viewer.status !== 'ready' || !iamReady || !access || !organizations) {
    return <main className="flex min-h-screen items-center justify-center gap-3 text-sm" style={{ background: colors.backgroundMuted, color: colors.textSecondary }}><Loader2 className="h-5 w-5 animate-spin" /> {tr('Načítám pracovní prostor…')}</main>;
  }

  const tabs: Array<{ id: WorkspaceTab; label: string; Icon: typeof Store; visible: boolean }> = [
    { id: 'support', label: 'Support', Icon: Users, visible: canReadDirectory },
    { id: 'partners', label: 'Partneři', Icon: Store, visible: canDraftPartner },
    { id: 'offers', label: 'Nabídky', Icon: Tags, visible: canDraftOffer },
    { id: 'campaigns', label: 'Kampaně', Icon: Megaphone, visible: canDraftCampaign },
    { id: 'events', label: 'Události', Icon: CalendarDays, visible: canManageEvents },
    { id: 'approvals', label: 'Schválení', Icon: ClipboardCheck, visible: canPublishOffer },
    { id: 'metrics', label: 'Metriky', Icon: BarChart3, visible: canReadMetrics },
    { id: 'privacy', label: 'Soukromí', Icon: ClipboardCheck, visible: canManagePrivacy },
  ];
  const visibleTabs = tabs.filter((tab) => tab.visible);

  if (visibleTabs.length === 0) {
    return <main className="flex min-h-screen items-center justify-center px-4" style={{ background: colors.backgroundMuted }}><Panel className="max-w-md p-6 text-center"><X className="mx-auto h-8 w-8" style={{ color: colors.dangerStrong }} /><h1 className="mt-3 text-xl font-semibold">{tr('Pracovní prostor není dostupný')}</h1><p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>{tr('Účet nemá assignment pro správu partnerů, nabídek nebo metrik.')}</p><button type="button" onClick={() => router.replace('/home')} className="mt-5 min-h-11 w-full font-semibold text-white" style={{ borderRadius: radii.md, background: colors.brandPrimary }}>{tr('Zpět do aplikace')}</button></Panel></main>;
  }

  const effectiveTab = visibleTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : visibleTabs[0].id;

  return (
    <main className="min-h-screen pb-10" style={{ background: colors.backgroundMuted, color: colors.textPrimary }}>
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur" style={{ borderColor: colors.border }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <button type="button" onClick={() => router.push('/home')} className="flex h-10 w-10 shrink-0 items-center justify-center border" aria-label={tr('Zpět do aplikace')} style={{ borderColor: colors.border, borderRadius: radii.md }}><ArrowLeft size={19} /></button>
          <PsychocasLogo size={38} />
          <div className="min-w-0 flex-1"><p className="text-sm font-bold" style={{ color: colors.brandPrimary }}>Psychočas</p><h1 className="truncate text-base font-semibold" style={{ color: colors.textPrimary }}>{tr('Pracovní prostor')}</h1></div>
          <button type="button" onClick={() => window.location.reload()} className="flex h-10 w-10 items-center justify-center border" aria-label={tr('Obnovit')} title={tr('Obnovit')} style={{ borderColor: colors.border, borderRadius: radii.md }}><RefreshCcw size={18} /></button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-6 sm:py-7">
        {message && <div role={message.type === 'error' ? 'alert' : 'status'} className="border px-4 py-3 text-sm" style={{ borderColor: message.type === 'error' ? '#fecaca' : '#a7f3d0', borderRadius: radii.md, background: message.type === 'error' ? colors.dangerSurface : colors.successSurface, color: message.type === 'error' ? colors.dangerStrong : colors.success }}>{tr(message.text)}</div>}

        <Panel className="p-3">
          <div className="grid gap-2 sm:grid-cols-[auto_minmax(12rem,1fr)] sm:items-center">
            <div className="grid grid-cols-2 gap-1 border bg-white p-1" style={{ borderColor: colors.border, borderRadius: radii.md }}>
              <button type="button" disabled={!canNational} onClick={() => setScope('national')} className="flex min-h-10 items-center justify-center gap-2 px-3 text-sm font-semibold" style={{ borderRadius: radii.sm, background: scope === 'national' ? colors.brandPrimary : colors.background, color: scope === 'national' ? colors.background : !canNational ? colors.textSecondary : colors.textPrimary }}><Globe2 size={16} /> {tr('Národní')}</button>
              <button type="button" disabled={availableBranches.length === 0} onClick={() => { setScope('local'); if (!branchId && availableBranches[0]) setBranchId(availableBranches[0].id); }} className="flex min-h-10 items-center justify-center gap-2 px-3 text-sm font-semibold" style={{ borderRadius: radii.sm, background: scope === 'local' ? colors.brandPrimary : colors.background, color: scope === 'local' ? colors.background : colors.textPrimary }}><MapPin size={16} /> {tr('Lokální')}</button>
            </div>
            {scope === 'local' && <select value={branchId} onChange={(event) => setBranchId(event.target.value as Id<'branches'>)} style={fieldStyle()} aria-label={tr('Pobočka')}><option value="" disabled>{tr('Vyber pobočku')}</option>{availableBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}, {branch.city}</option>)}</select>}
          </div>
        </Panel>

        <nav className="flex gap-1 overflow-x-auto border bg-white p-1" style={{ borderColor: colors.border, borderRadius: radii.md }} aria-label={tr('Pracovní moduly')}>
          {visibleTabs.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => setActiveTab(id)} className="flex min-h-10 shrink-0 items-center justify-center gap-2 px-3 text-sm font-semibold" style={{ borderRadius: radii.sm, background: effectiveTab === id ? colors.brandPrimary : colors.background, color: effectiveTab === id ? colors.background : colors.textSecondary }}><Icon size={17} /> {tr(label)}</button>)}
        </nav>

        {effectiveTab === 'support' && canReadDirectory && (
          <div className="space-y-4">
            <Panel className="p-4">
              <h2 className="font-semibold">{tr('Omezená členská diagnostika')}</h2>
              <p className="mt-1 text-sm leading-6" style={{ color: colors.textSecondary }}>{tr('Vyhledávání ukazuje stav přístupu a poslední přihlášení. Neobsahuje historii nabídek ani QR použití.')}</p>
              <input value={directorySearch} onChange={(event) => setDirectorySearch(event.target.value)} placeholder={tr('Jméno nebo celý email')} className="mt-3" style={fieldStyle()} />
            </Panel>
            <Panel className="overflow-hidden">
              <div className="divide-y" style={{ borderColor: colors.border }}>
                {directory?.map((entry) => <article key={entry.accessGrantId} className="px-4 py-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold">{entry.fullName}</h3><p className="truncate text-sm" style={{ color: colors.textSecondary }}>{entry.email}</p></div><span className="px-2 py-1 text-xs font-semibold" style={{ borderRadius: radii.sm, background: entry.status === 'active' ? colors.successSurface : colors.dangerSurface, color: entry.status === 'active' ? colors.success : colors.dangerStrong }}>{tr(entry.status === 'active' ? 'Aktivní' : 'Neaktivní')}</span></div><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt style={{ color: colors.textSecondary }}>{tr('Členství do')}</dt><dd className="mt-1 font-semibold">{new Date(entry.membershipUntil).toLocaleDateString(getDateLocale(locale))}</dd></div><div><dt style={{ color: colors.textSecondary }}>{tr('Poslední login')}</dt><dd className="mt-1 font-semibold">{entry.lastSeenAt ? new Date(entry.lastSeenAt).toLocaleString(getDateLocale(locale)) : tr('Zatím ne')}</dd></div></dl></article>)}
                {directorySearch.trim().length < 2 && <p className="px-4 py-10 text-center text-sm" style={{ color: colors.textSecondary }}>{tr('Zadej alespoň dva znaky.')}</p>}
                {directorySearch.trim().length >= 2 && directory?.length === 0 && <p className="px-4 py-10 text-center text-sm" style={{ color: colors.textSecondary }}>{tr('Nebyl nalezen odpovídající člen v povoleném scope.')}</p>}
              </div>
            </Panel>
          </div>
        )}

        {effectiveTab === 'partners' && canDraftPartner && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Panel className="overflow-hidden">
              <div className="border-b px-4 py-4" style={{ borderColor: colors.border }}><h2 className="font-semibold">{tr('Partneři')}</h2><p className="text-sm" style={{ color: colors.textSecondary }}>{partners ? tr('{count} záznamů').replace('{count}', String(partners.length)) : tr('Načítám…')}</p></div>
              <div className="divide-y" style={{ borderColor: colors.border }}>
                {partners?.map((partner) => <article key={partner.id} className="flex items-center gap-3 px-4 py-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center" style={{ borderRadius: radii.md, background: colors.brandSurface, color: colors.brandPrimary }}><Store size={18} /></span><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{partner.name}</h3><p className="text-xs" style={{ color: colors.textSecondary }}>{tr(categoryLabels[partner.category])} · {tr(partner.scope === 'national' ? 'národní' : 'lokální')}</p></div><span className="text-xs font-semibold" style={{ color: partner.active ? colors.success : colors.textSecondary }}>{tr(partner.active ? 'Aktivní' : 'Archiv')}</span>{canApprovePartner && <button type="button" onClick={() => void setPartnerActive({ id: partner.id, active: !partner.active }).catch(() => setMessage({ type: 'error', text: 'Stav partnera se nepodařilo změnit.' }))} className="flex h-10 w-10 items-center justify-center border" aria-label={tr(partner.active ? 'Archivovat partnera' : 'Obnovit partnera')} title={tr(partner.active ? 'Archivovat' : 'Obnovit')} style={{ borderColor: colors.border, borderRadius: radii.md }}>{partner.active ? <Pause size={17} /> : <Check size={17} />}</button>}</article>)}
                {partners?.length === 0 && <p className="px-4 py-10 text-center text-sm" style={{ color: colors.textSecondary }}>{tr('V tomto scope zatím není partner.')}</p>}
              </div>
            </Panel>
            <Panel className="h-max p-4 lg:sticky lg:top-20">
              <div className="mb-4 flex items-center gap-2"><Plus size={18} style={{ color: colors.brandPrimary }} /><h2 className="font-semibold">{tr('Nový partner')}</h2></div>
              <form onSubmit={handlePartnerSave} className="space-y-3">
                <input value={partnerForm.name} onChange={(event) => setPartnerForm((current) => ({ ...current, name: event.target.value }))} placeholder={tr('Název partnera')} required style={fieldStyle()} />
                <select value={partnerForm.category} onChange={(event) => setPartnerForm((current) => ({ ...current, category: event.target.value as PartnerCategory }))} style={fieldStyle()}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{tr(label)}</option>)}</select>
                <input value={partnerForm.website} onChange={(event) => setPartnerForm((current) => ({ ...current, website: event.target.value }))} placeholder="https://partner.cz" inputMode="url" style={fieldStyle()} />
                <textarea value={partnerForm.description} onChange={(event) => setPartnerForm((current) => ({ ...current, description: event.target.value }))} placeholder={tr('Krátký popis')} rows={3} style={{ ...fieldStyle(), resize: 'vertical' }} />
                <button type="submit" disabled={saving || !partnerForm.name.trim()} className="flex min-h-11 w-full items-center justify-center gap-2 font-semibold text-white" style={{ borderRadius: radii.md, background: saving ? colors.textSecondary : colors.brandPrimary }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={17} />} {tr('Uložit partnera')}</button>
              </form>
            </Panel>
          </div>
        )}

        {effectiveTab === 'offers' && canDraftOffer && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Panel className="overflow-hidden">
              <div className="border-b px-4 py-4" style={{ borderColor: colors.border }}><h2 className="font-semibold">{tr('Nabídky')}</h2><p className="text-sm" style={{ color: colors.textSecondary }}>{offers ? tr('{count} záznamů').replace('{count}', String(offers.length)) : tr('Načítám…')}</p></div>
              <div className="divide-y" style={{ borderColor: colors.border }}>
                {offers?.map((offer) => <article key={offer.id} className="px-4 py-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center" style={{ borderRadius: radii.md, background: colors.accentMuted, color: colors.brandPrimary }}><Tags size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{offer.title}</h3><span className="px-2 py-1 text-xs font-semibold" style={{ borderRadius: radii.sm, background: colors.neutralSurface, color: colors.textSecondary }}>{tr(statusLabel(offer.status))}</span></div><p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>{offer.partner.name} · <strong style={{ color: colors.brandPrimary }}>{offer.value}</strong></p></div></div><div className="mt-3 flex flex-wrap gap-2">{offer.status === 'draft' && <button type="button" onClick={() => void submitOffer({ id: offer.id }).then(() => setMessage({ type: 'success', text: 'Nabídka čeká na schválení.' })).catch(() => setMessage({ type: 'error', text: 'Nabídku nelze odeslat ke schválení.' }))} className="flex min-h-10 items-center gap-2 border px-3 text-sm font-semibold" style={{ borderColor: colors.brandPrimary, borderRadius: radii.md, color: colors.brandPrimary }}><Send size={16} /> {tr('Ke schválení')}</button>}{(offer.status === 'published' || offer.status === 'active') && canPublishOffer && <button type="button" onClick={() => void setOfferPaused({ id: offer.id, paused: true })} className="flex min-h-10 items-center gap-2 border px-3 text-sm font-semibold" style={{ borderColor: colors.border, borderRadius: radii.md }}><Pause size={16} /> {tr('Pozastavit')}</button>}{offer.status === 'paused' && canPublishOffer && <button type="button" onClick={() => void setOfferPaused({ id: offer.id, paused: false })} className="flex min-h-10 items-center gap-2 border px-3 text-sm font-semibold" style={{ borderColor: colors.border, borderRadius: radii.md }}><Check size={16} /> {tr('Obnovit')}</button>}</div></article>)}
                {offers?.length === 0 && <p className="px-4 py-10 text-center text-sm" style={{ color: colors.textSecondary }}>{tr('V tomto scope zatím není nabídka.')}</p>}
              </div>
            </Panel>
            <Panel className="h-max p-4 lg:sticky lg:top-20">
              <div className="mb-4 flex items-center gap-2"><Plus size={18} style={{ color: colors.brandPrimary }} /><h2 className="font-semibold">{tr('Nový draft')}</h2></div>
              <form onSubmit={handleOfferSave} className="space-y-3">
                <select value={offerForm.partnerId} onChange={(event) => setOfferForm((current) => ({ ...current, partnerId: event.target.value as Id<'partners'> }))} required style={fieldStyle()}><option value="" disabled>{tr('Vyber partnera')}</option>{partners?.filter((partner) => partner.active).map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select>
                <input value={offerForm.title} onChange={(event) => setOfferForm((current) => ({ ...current, title: event.target.value }))} placeholder={tr('Název nabídky')} required style={fieldStyle()} />
                <input value={offerForm.value} onChange={(event) => setOfferForm((current) => ({ ...current, value: event.target.value }))} placeholder={tr('15 %, 2+1, zdarma…')} required style={fieldStyle()} />
                <textarea value={offerForm.description} onChange={(event) => setOfferForm((current) => ({ ...current, description: event.target.value }))} placeholder={tr('Podmínky nabídky')} rows={3} style={{ ...fieldStyle(), resize: 'vertical' }} />
                <div className="grid grid-cols-2 gap-2"><label className="text-xs" style={{ color: colors.textSecondary }}>{tr('Platí od')}<input type="date" value={offerForm.validFrom} onChange={(event) => setOfferForm((current) => ({ ...current, validFrom: event.target.value }))} className="mt-1" style={fieldStyle()} /></label><label className="text-xs" style={{ color: colors.textSecondary }}>{tr('Platí do')}<input type="date" value={offerForm.validUntil} onChange={(event) => setOfferForm((current) => ({ ...current, validUntil: event.target.value }))} className="mt-1" style={fieldStyle()} /></label></div>
                <button type="submit" disabled={saving || !offerForm.partnerId || !offerForm.title.trim() || !offerForm.value.trim()} className="flex min-h-11 w-full items-center justify-center gap-2 font-semibold text-white" style={{ borderRadius: radii.md, background: saving ? colors.textSecondary : colors.brandPrimary }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={17} />} {tr('Uložit draft')}</button>
              </form>
            </Panel>
          </div>
        )}

        {effectiveTab === 'campaigns' && canDraftCampaign && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Panel className="overflow-hidden">
              <div className="border-b px-4 py-4" style={{ borderColor: colors.border }}><h2 className="font-semibold">{tr('Kampaně a oznámení')}</h2><p className="text-sm" style={{ color: colors.textSecondary }}>{campaigns ? tr('{count} záznamů').replace('{count}', String(campaigns.length)) : tr('Načítám…')}</p></div>
              <div className="divide-y" style={{ borderColor: colors.border }}>
                {campaigns?.map((campaign) => <article key={campaign._id} className="px-4 py-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center" style={{ borderRadius: radii.md, background: colors.brandSurface, color: colors.brandPrimary }}><Megaphone size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{campaign.title}</h3><span className="px-2 py-1 text-xs font-semibold" style={{ borderRadius: radii.sm, background: colors.neutralSurface, color: colors.textSecondary }}>{tr(workflowStatusLabel(campaign.status))}</span></div>{campaign.description && <p className="mt-1 text-sm leading-6" style={{ color: colors.textSecondary }}>{campaign.description}</p>}</div></div>{canSendCampaign && <div className="mt-3 flex flex-wrap gap-2">{campaign.status === 'draft' && <button type="button" onClick={() => void publishCampaign({ id: campaign._id }).then(() => setMessage({ type: 'success', text: 'Kampaň byla publikována.' })).catch(() => setMessage({ type: 'error', text: 'Kampaň se nepodařilo publikovat.' }))} className="flex min-h-10 items-center gap-2 border px-3 text-sm font-semibold" style={{ borderColor: colors.brandPrimary, borderRadius: radii.md, color: colors.brandPrimary }}><Check size={16} /> {tr('Publikovat')}</button>}{(campaign.status === 'active' || campaign.status === 'scheduled') && <button type="button" onClick={() => void queueCampaign({ campaignId: campaign._id }).then((result) => setMessage({ type: 'success', text: tr('Do fronty bylo zařazeno {count} oznámení.').replace('{count}', String(result.queuedCount)) })).catch(() => setMessage({ type: 'error', text: 'Push není nakonfigurovaný nebo už byla kampaň zařazena.' }))} className="flex min-h-10 items-center gap-2 px-3 text-sm font-semibold text-white" style={{ borderRadius: radii.md, background: colors.brandPrimary }}><BellRing size={16} /> {tr('Zařadit push')}</button>}</div>}</article>)}
                {campaigns?.length === 0 && <p className="px-4 py-10 text-center text-sm" style={{ color: colors.textSecondary }}>{tr('V tomto scope zatím není kampaň.')}</p>}
              </div>
            </Panel>
            <Panel className="h-max p-4 lg:sticky lg:top-20">
              <div className="mb-4 flex items-center gap-2"><Plus size={18} style={{ color: colors.brandPrimary }} /><h2 className="font-semibold">{tr('Nová kampaň')}</h2></div>
              <form onSubmit={handleCampaignSave} className="space-y-3">
                <input value={campaignForm.title} onChange={(event) => setCampaignForm((current) => ({ ...current, title: event.target.value }))} placeholder={tr('Název kampaně')} required style={fieldStyle()} />
                <textarea value={campaignForm.description} onChange={(event) => setCampaignForm((current) => ({ ...current, description: event.target.value }))} placeholder={tr('Text oznámení')} rows={4} style={{ ...fieldStyle(), resize: 'vertical' }} />
                <label className="block text-xs" style={{ color: colors.textSecondary }}>{tr('Začátek')}<input type="datetime-local" value={campaignForm.validFrom} onChange={(event) => setCampaignForm((current) => ({ ...current, validFrom: event.target.value }))} className="mt-1" style={fieldStyle()} /></label>
                <label className="block text-xs" style={{ color: colors.textSecondary }}>{tr('Konec')}<input type="datetime-local" value={campaignForm.validUntil} onChange={(event) => setCampaignForm((current) => ({ ...current, validUntil: event.target.value }))} className="mt-1" style={fieldStyle()} /></label>
                <button type="submit" disabled={saving || campaignForm.title.trim().length < 2} className="flex min-h-11 w-full items-center justify-center gap-2 font-semibold text-white" style={{ borderRadius: radii.md, background: saving ? colors.textSecondary : colors.brandPrimary }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={17} />} {tr('Uložit draft')}</button>
              </form>
            </Panel>
          </div>
        )}

        {effectiveTab === 'events' && canManageEvents && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <Panel className="overflow-hidden">
                <div className="border-b px-4 py-4" style={{ borderColor: colors.border }}><h2 className="font-semibold">{tr('Události')}</h2><p className="text-sm" style={{ color: colors.textSecondary }}>{events ? tr('{count} záznamů').replace('{count}', String(events.length)) : tr('Načítám…')}</p></div>
                <div className="divide-y" style={{ borderColor: colors.border }}>
                  {events?.map((event) => <article key={event._id} className="px-4 py-4"><div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0" style={{ color: colors.brandPrimary }} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{event.title}</h3><span className="px-2 py-1 text-xs font-semibold" style={{ borderRadius: radii.sm, background: colors.neutralSurface, color: colors.textSecondary }}>{tr(workflowStatusLabel(event.status))}</span></div><p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>{new Date(event.startsAt).toLocaleString(getDateLocale(locale))}{event.location ? ` · ${event.location}` : ''}</p><p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>{event.checkInCount}{event.capacity ? ` / ${event.capacity}` : ''} check-in</p></div></div><div className="mt-3 flex flex-wrap gap-2">{event.status === 'draft' && <button type="button" onClick={() => void publishEvent({ id: event._id }).then(() => setMessage({ type: 'success', text: 'Událost byla publikována.' })).catch(() => setMessage({ type: 'error', text: 'Událost se nepodařilo publikovat.' }))} className="flex min-h-10 items-center gap-2 border px-3 text-sm font-semibold" style={{ borderColor: colors.brandPrimary, borderRadius: radii.md, color: colors.brandPrimary }}><Check size={16} /> {tr('Publikovat')}</button>}{canCheckIn && (event.status === 'active' || event.status === 'scheduled') && <button type="button" onClick={() => { setSelectedEventId(event._id); setEventCheckInSearch(''); }} className="flex min-h-10 items-center gap-2 border px-3 text-sm font-semibold" style={{ borderColor: selectedEventId === event._id ? colors.brandPrimary : colors.border, borderRadius: radii.md, color: colors.brandPrimary }}><UserCheck size={16} /> Check-in</button>}</div></article>)}
                  {events?.length === 0 && <p className="px-4 py-10 text-center text-sm" style={{ color: colors.textSecondary }}>{tr('V tomto scope zatím není událost.')}</p>}
                </div>
              </Panel>
              <Panel className="h-max p-4 lg:sticky lg:top-20">
                <div className="mb-4 flex items-center gap-2"><Plus size={18} style={{ color: colors.brandPrimary }} /><h2 className="font-semibold">{tr('Nová událost')}</h2></div>
                <form onSubmit={handleEventSave} className="space-y-3">
                  <input value={eventForm.title} onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))} placeholder={tr('Název události')} required style={fieldStyle()} />
                  <textarea value={eventForm.description} onChange={(event) => setEventForm((current) => ({ ...current, description: event.target.value }))} placeholder={tr('Popis')} rows={3} style={{ ...fieldStyle(), resize: 'vertical' }} />
                  <input value={eventForm.location} onChange={(event) => setEventForm((current) => ({ ...current, location: event.target.value }))} placeholder={tr('Místo')} style={fieldStyle()} />
                  <input type="number" min="1" max="10000" value={eventForm.capacity} onChange={(event) => setEventForm((current) => ({ ...current, capacity: event.target.value }))} placeholder={tr('Kapacita (volitelné)')} style={fieldStyle()} />
                  <label className="block text-xs" style={{ color: colors.textSecondary }}>{tr('Začátek')}<input type="datetime-local" value={eventForm.startsAt} onChange={(event) => setEventForm((current) => ({ ...current, startsAt: event.target.value }))} required className="mt-1" style={fieldStyle()} /></label>
                  <label className="block text-xs" style={{ color: colors.textSecondary }}>{tr('Konec')}<input type="datetime-local" value={eventForm.endsAt} onChange={(event) => setEventForm((current) => ({ ...current, endsAt: event.target.value }))} className="mt-1" style={fieldStyle()} /></label>
                  <button type="submit" disabled={saving || eventForm.title.trim().length < 2 || !eventForm.startsAt} className="flex min-h-11 w-full items-center justify-center gap-2 font-semibold text-white" style={{ borderRadius: radii.md, background: saving ? colors.textSecondary : colors.brandPrimary }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={17} />} {tr('Uložit draft')}</button>
                </form>
              </Panel>
            </div>
            {canCheckIn && selectedEventId && <Panel className="p-4"><div className="flex items-center gap-2"><UserCheck size={19} style={{ color: colors.brandPrimary }} /><h2 className="font-semibold">{tr('Check-in člena')}</h2></div><p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>{tr('Vyhledej člena jménem nebo celým emailem. Zobrazují se jen údaje nutné pro odbavení.')}</p><input value={eventCheckInSearch} onChange={(event) => setEventCheckInSearch(event.target.value)} placeholder={tr('Jméno nebo celý email')} className="mt-3" style={fieldStyle()} /><div className="mt-3 divide-y" style={{ borderColor: colors.border }}>{eventCandidates?.map((candidate) => <div key={candidate.accessGrantId} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{candidate.fullName}</p><p className="truncate text-xs" style={{ color: colors.textSecondary }}>{candidate.email}</p></div><button type="button" disabled={candidate.status !== 'active'} onClick={() => void checkInMember({ eventId: selectedEventId, accessGrantId: candidate.accessGrantId }).then((result) => setMessage({ type: 'success', text: result.status === 'already_checked_in' ? 'Člen už byl odbaven.' : 'Check-in byl uložen.' })).catch(() => setMessage({ type: 'error', text: 'Check-in se nepodařilo uložit.' }))} className="min-h-10 px-3 text-sm font-semibold text-white" style={{ borderRadius: radii.md, background: candidate.status === 'active' ? colors.brandPrimary : colors.textSecondary }}>{tr('Odbavit')}</button></div>)}{eventCheckInSearch.trim().length >= 2 && eventCandidates?.length === 0 && <p className="py-6 text-center text-sm" style={{ color: colors.textSecondary }}>{tr('Nebyl nalezen aktivní člen v tomto scope.')}</p>}</div></Panel>}
          </div>
        )}

        {effectiveTab === 'approvals' && canPublishOffer && (
          <Panel className="overflow-hidden">
            <div className="border-b px-4 py-4" style={{ borderColor: colors.border }}><h2 className="font-semibold">{tr('Čeká na schválení')}</h2><p className="text-sm" style={{ color: colors.textSecondary }}>{approvals ? tr('{count} požadavků').replace('{count}', String(approvals.length)) : tr('Načítám…')}</p></div>
            <div className="divide-y" style={{ borderColor: colors.border }}>
              {approvals?.map((approval) => <article key={approval.id} className="px-4 py-4"><div className="flex items-start gap-3"><ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: colors.brandPrimary }} /><div className="min-w-0 flex-1"><h3 className="font-semibold">{approval.offer?.title ?? approval.entityType}</h3><p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>{approval.offer?.value} · {tr('připravil/a')} {approval.requestedBy}</p></div></div>{approval.entityType === 'offer' && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => void reviewOffer({ id: approval.entityId as Id<'offers'>, approve: false, comment: 'Vráceno k doplnění.' }).then(() => setMessage({ type: 'success', text: 'Nabídka byla vrácena do draftu.' }))} className="min-h-10 border font-semibold" style={{ borderColor: colors.border, borderRadius: radii.md, color: colors.dangerStrong }}>{tr('Vrátit')}</button><button type="button" onClick={() => void reviewOffer({ id: approval.entityId as Id<'offers'>, approve: true }).then(() => setMessage({ type: 'success', text: 'Nabídka byla publikována.' }))} className="flex min-h-10 items-center justify-center gap-2 font-semibold text-white" style={{ borderRadius: radii.md, background: colors.brandPrimary }}><Check size={17} /> {tr('Publikovat')}</button></div>}</article>)}
              {approvals?.length === 0 && <p className="px-4 py-10 text-center text-sm" style={{ color: colors.textSecondary }}>{tr('Fronta je prázdná.')}</p>}
            </div>
          </Panel>
        )}

        {effectiveTab === 'metrics' && canReadMetrics && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[{ label: 'Vydané kódy', value: metrics?.totals.generated ?? 0 }, { label: 'Validní použití', value: metrics?.totals.valid ?? 0 }, { label: 'Skeny', value: metrics?.totals.scanned ?? 0 }, { label: 'Úspěšnost', value: `${Math.round((metrics?.validationRate ?? 0) * 100)} %` }].map((metric) => <Panel key={metric.label} className="px-4 py-4"><p className="text-xs" style={{ color: colors.textSecondary }}>{tr(metric.label)}</p><p className="mt-1 text-2xl font-bold" style={{ color: colors.brandPrimary }}>{metric.value}</p></Panel>)}
            </div>
            <Panel className="overflow-hidden"><div className="border-b px-4 py-4" style={{ borderColor: colors.border }}><h2 className="font-semibold">{tr('Nejpoužívanější nabídky')}</h2><p className="text-sm" style={{ color: colors.textSecondary }}>{tr('Pouze agregovaná data, bez historie členů.')}</p></div><div className="divide-y" style={{ borderColor: colors.border }}>{metrics?.topOffers.map((offer, index) => <div key={offer.offerId} className="flex items-center gap-3 px-4 py-3"><span className="flex h-8 w-8 items-center justify-center text-sm font-bold" style={{ borderRadius: radii.md, background: colors.brandSurface, color: colors.brandPrimary }}>{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{offer.title}</p><p className="truncate text-xs" style={{ color: colors.textSecondary }}>{offer.partnerName}</p></div><p className="text-sm font-bold" style={{ color: colors.success }}>{offer.valid} {tr('použití')}</p></div>)}{metrics?.topOffers.length === 0 && <p className="px-4 py-10 text-center text-sm" style={{ color: colors.textSecondary }}>{tr('Metriky vzniknou po prvních QR ověřeních.')}</p>}</div></Panel>
          </div>
        )}

        {effectiveTab === 'privacy' && canManagePrivacy && (
          <Panel className="overflow-hidden">
            <div className="border-b px-4 py-4" style={{ borderColor: colors.border }}><h2 className="font-semibold">{tr('Privacy požadavky')}</h2><p className="text-sm" style={{ color: colors.textSecondary }}>{privacyRequests ? tr('{count} záznamů').replace('{count}', String(privacyRequests.length)) : tr('Načítám…')}</p></div>
            <div className="divide-y" style={{ borderColor: colors.border }}>
              {privacyRequests?.map((request) => <article key={request.id} className="px-4 py-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold">{request.member?.fullName ?? tr('Neaktivní účet')}</h3><p className="truncate text-sm" style={{ color: colors.textSecondary }}>{request.member?.email}</p></div><span className="px-2 py-1 text-xs font-semibold" style={{ borderRadius: radii.sm, background: colors.neutralSurface }}>{tr(privacyTypeLabel(request.type))} · {tr(workflowStatusLabel(request.status))}</span></div>{request.message && <p className="mt-3 text-sm leading-6" style={{ color: colors.textSecondary }}>{request.message}</p>}{(request.status === 'submitted' || request.status === 'in_review') && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => void resolvePrivacyRequest({ id: request.id, status: 'in_review' })} className="min-h-10 border font-semibold" style={{ borderColor: colors.border, borderRadius: radii.md }}>{tr('Řeší se')}</button><button type="button" onClick={() => void resolvePrivacyRequest({ id: request.id, status: 'completed', resolution: 'Požadavek byl zpracován odpovědnou osobou.' })} className="min-h-10 font-semibold text-white" style={{ borderRadius: radii.md, background: colors.brandPrimary }}>{tr('Dokončit')}</button></div>}</article>)}
              {privacyRequests?.length === 0 && <p className="px-4 py-10 text-center text-sm" style={{ color: colors.textSecondary }}>{tr('Žádný privacy požadavek.')}</p>}
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}
