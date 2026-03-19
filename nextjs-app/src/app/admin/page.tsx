'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Navigation from '@/components/Navigation';
import useMemberContext from '@/hooks/useMemberContext';
import useLocale from '@/hooks/useLocale';
import { supabase } from '@/lib/supabaseClient';
import type { LucideIcon } from 'lucide-react';
import {
  Users,
  UserCheck,
  Mail,
  Phone,
  MapPin,
  RefreshCcw,
  ToggleRight,
  Tag,
  Trash2,
  Download,
  Edit3,
  Save,
  X,
  Megaphone,
  CalendarClock,
  FileText,
  BarChart3,
  Globe2,
  UserPlus,
} from 'lucide-react';
import type { PartnerOfferFormErrors, PartnerOfferFormState, PartnerOfferRecord, PartnerScope } from '@/lib/partners';
import { preparePartnerOfferPayload } from '@/lib/partners';
import type { MemberRole } from '@/types/member';
import { colors } from '@/ui/theme';

interface AdminMember {
  user_id: string;
  email: string;
  full_name: string | null;
  role: MemberRole;
  membership_active: boolean;
  membership_expires: string | null;
  approved: boolean;
  approved_at: string | null;
  phone: string | null;
}

interface WhitelistEntry {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: MemberRole;
  branch_id: string | null;
  note: string | null;
  invited_at: string;
  invited_by: string | null;
  consumed_at: string | null;
  consumed_by: string | null;
  active: boolean;
}

interface BranchRow {
  id: string;
  name: string;
  location: string | null;
  discount_percentage: number;
  active: boolean;
}

interface NewsItem {
  id: string;
  title: string;
  body: string;
  status: 'draft' | 'scheduled' | 'published';
  publish_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

type AdminTab = 'members' | 'branches' | 'partners' | 'news';

type PartnerOfferDraft = PartnerOfferFormState & { id?: string; active: boolean };

interface OverviewCard {
  id: string;
  icon: LucideIcon;
  value: string;
  label: string;
}

const demoMembers: AdminMember[] = [
  {
    user_id: 'demo-1',
    email: 'member@psychocas.cz',
    full_name: 'Demo Člen',
    role: 'member',
    membership_active: true,
    membership_expires: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    approved: true,
    approved_at: new Date().toISOString(),
    phone: '+420123456789',
  },
];

const demoWhitelist: WhitelistEntry[] = [
  {
    id: 'demo-allow-1',
    email: 'invite@psychocas.cz',
    first_name: 'Nový',
    last_name: 'Člen',
    phone: '+420777888999',
    role: 'member',
    branch_id: null,
    note: 'Ukázková pozvánka',
    invited_at: new Date().toISOString(),
    invited_by: 'demo',
    consumed_at: null,
    consumed_by: null,
    active: true,
  },
];

const demoBranches: BranchRow[] = [
  { id: 'demo-branch', name: 'Demo Branch', location: 'Praha', discount_percentage: 10, active: true },
];

const demoPartners: PartnerOfferRecord[] = [
  {
    id: 'demo-offer',
    title: 'Demo kavárna',
    description: 'Ukázková sleva 10 %',
    discount_code: 'DEMO10',
    discount_percentage: 10,
    scope: 'national',
    branch_id: null,
    city: 'Praha',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'demo',
    updated_by: 'demo',
    branch: null,
    creator: null,
    updater: null,
  },
];

const demoNews: NewsItem[] = [
  {
    id: 'demo-news-1',
    title: 'Vítejte v Psychočas',
    body: 'Toto je ukázková novinka. Publikujte vlastní zprávy přímo z administrace.',
    status: 'published',
    publish_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'demo',
    updated_by: 'demo',
  },
];

export default function AdminPage() {
  const { t, formatMessage, locale } = useLocale();
  const { status, member, user, error, refresh } = useMemberContext({ scope: 'admin-page' });
  const memberRole = member?.role ?? 'member';
  const isAdmin = memberRole === 'admin';
  const isCouncil = memberRole === 'council';
  const isPsychocasManager = memberRole === 'manager' && Boolean(member?.email?.toLowerCase().endsWith('@psychocas.cz'));
  const canAccess = isAdmin || isCouncil || isPsychocasManager;
  const isDemo = member?.origin === 'demo';
  const memberBranchId = member?.branch?.id ?? null;

  const [activeTab, setActiveTab] = useState<AdminTab>('members');

  const [members, setMembers] = useState<AdminMember[]>([]);
  const [whitelistEntries, setWhitelistEntries] = useState<WhitelistEntry[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [partnerOffers, setPartnerOffers] = useState<PartnerOfferRecord[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);

  const [newBranch, setNewBranch] = useState({
    name: '',
    location: '',
    discount_percentage: 10,
  });
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchDraft, setBranchDraft] = useState({
    name: '',
    location: '',
    discount_percentage: 10,
    active: true,
  });
  const [isSavingBranch, setIsSavingBranch] = useState(false);

  const [newOffer, setNewOffer] = useState<PartnerOfferFormState>({
    title: '',
    description: '',
    discountCode: '',
    discountPercentage: 10,
    scope: 'national',
    branchId: '',
    city: '',
  });
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [offerDraft, setOfferDraft] = useState<PartnerOfferDraft>({
    id: undefined,
    title: '',
    description: '',
    discountCode: '',
    discountPercentage: 10,
    scope: 'national',
    branchId: '',
    city: '',
    active: true,
  });
  const [offerErrors, setOfferErrors] = useState<PartnerOfferFormErrors>({});
  const [isSavingOffer, setIsSavingOffer] = useState(false);
  const [isSavingExistingOffer, setIsSavingExistingOffer] = useState(false);

  const [whitelistForm, setWhitelistForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'member' as MemberRole,
    branchId: '',
    note: '',
  });
  const [isSavingWhitelist, setIsSavingWhitelist] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newsDraft, setNewsDraft] = useState({
    title: '',
    body: '',
    status: 'draft' as NewsItem['status'],
    publishAt: '',
  });
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [isSavingNews, setIsSavingNews] = useState(false);

  const loadMembers = useCallback(async () => {
    if (isDemo) {
      setMembers(demoMembers);
      return;
    }

    const { data } = await supabase
      .from('memberships')
      .select('user_id, email, full_name, role, membership_active, membership_expires, approved, approved_at, phone')
      .order('created_at', { ascending: false });

    if (data) {
      const normalized = (data as AdminMember[]).map((entry) => ({
        ...entry,
        role: (entry.role ?? 'member') as MemberRole,
      }));
      setMembers(normalized);
    }
  }, [isDemo]);

  const loadWhitelist = useCallback(async () => {
    if (isDemo) {
      setWhitelistEntries(demoWhitelist);
      return;
    }

    const { data } = await supabase
      .from('membership_whitelist_status')
      .select(
        'id, email, first_name, last_name, phone, role, branch_id, note, invited_at, invited_by, consumed_at, consumed_by, active'
      )
      .order('invited_at', { ascending: false });

    if (data) {
      const normalized = (data as WhitelistEntry[]).map((entry) => ({
        ...entry,
        role: (entry.role ?? 'member') as MemberRole,
      }));
      setWhitelistEntries(normalized);
    }
  }, [isDemo]);

  const loadBranches = useCallback(async () => {
    if (isDemo) {
      setBranches(demoBranches);
      return;
    }

    const { data } = await supabase
      .from('branches')
      .select('id, name, location, discount_percentage, active')
      .order('name');

    if (data) {
      setBranches(data as BranchRow[]);
    }
  }, [isDemo]);

  const loadPartnerOffers = useCallback(async () => {
    if (isDemo) {
      setPartnerOffers(demoPartners);
      return;
    }

    const { data } = await supabase
      .from('partner_offers')
      .select(
        `id, title, description, discount_code, discount_percentage, scope, branch_id, city, active,
         created_at, updated_at, created_by, updated_by`
      )
      .order('created_at', { ascending: false });

    if (data) {
      setPartnerOffers(data as PartnerOfferRecord[]);
    }
  }, [isDemo]);

  const loadNewsItems = useCallback(async () => {
    if (isDemo) {
      setNewsItems(demoNews);
      return;
    }

    const { data } = await supabase
      .from('news_items')
      .select(
        'id, title, body, status, publish_at, created_at, updated_at, created_by, updated_by'
      )
      .order('publish_at', { ascending: false });

    if (data) {
      setNewsItems(data as NewsItem[]);
    }
  }, [isDemo]);

  useEffect(() => {
    if (!canAccess || status !== 'ready') {
      return;
    }

    void Promise.all([loadMembers(), loadWhitelist(), loadBranches(), loadPartnerOffers(), loadNewsItems()]);
  }, [canAccess, loadBranches, loadMembers, loadNewsItems, loadPartnerOffers, loadWhitelist, status]);

  const handleWhitelistFieldChange = useCallback(<K extends keyof typeof whitelistForm>(field: K, value: typeof whitelistForm[K]) => {
    setWhitelistForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreateWhitelistEntry = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const normalizedEmail = whitelistForm.email.trim().toLowerCase();

      if (!normalizedEmail) {
        setMessage({ type: 'error', text: t('admin.messages.errorGeneric') });
        return;
      }

      const payload = {
        email: normalizedEmail,
        first_name: whitelistForm.firstName.trim() || null,
        last_name: whitelistForm.lastName.trim() || null,
        phone: whitelistForm.phone.trim() || null,
        role: whitelistForm.role,
        branch_id: whitelistForm.branchId || null,
        note: whitelistForm.note.trim() || null,
        invited_by: user?.id ?? null,
      };

      if (isDemo) {
        const newEntry: WhitelistEntry = {
          id: (globalThis.crypto?.randomUUID?.() ?? `demo-${Date.now()}`) as string,
          email: payload.email,
          first_name: payload.first_name,
          last_name: payload.last_name,
          phone: payload.phone,
          role: payload.role,
          branch_id: payload.branch_id,
          note: payload.note,
          invited_at: new Date().toISOString(),
          invited_by: payload.invited_by ?? 'demo',
          consumed_at: null,
          consumed_by: null,
          active: true,
        };
        setWhitelistEntries((prev) => [newEntry, ...prev]);
        setWhitelistForm({ email: '', firstName: '', lastName: '', phone: '', role: whitelistForm.role, branchId: '', note: '' });
        setMessage({ type: 'success', text: t('admin.messages.success') });
        return;
      }

      setIsSavingWhitelist(true);

      const { error: insertError } = await supabase.from('membership_whitelist').insert([payload]);

      if (insertError) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: insertError.message }) });
      } else {
        setMessage({ type: 'success', text: t('admin.messages.success') });
        setWhitelistForm({ email: '', firstName: '', lastName: '', phone: '', role: whitelistForm.role, branchId: '', note: '' });
        await loadWhitelist();
      }

      setIsSavingWhitelist(false);
    },
    [formatMessage, isDemo, loadWhitelist, t, user, whitelistForm]
  );

  const handleToggleWhitelistEntry = useCallback(
    async (entry: WhitelistEntry) => {
      const nextActive = !entry.active;

      if (isDemo) {
        setWhitelistEntries((prev) =>
          prev.map((item) => (item.id === entry.id ? { ...item, active: nextActive } : item))
        );
        return;
      }

      const { error: updateError } = await supabase
        .from('membership_whitelist')
        .update({ active: nextActive })
        .eq('id', entry.id);

      if (updateError) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: updateError.message }) });
      } else {
        await loadWhitelist();
        setMessage({ type: 'success', text: t('admin.messages.success') });
      }
    },
    [formatMessage, isDemo, loadWhitelist, t]
  );

  const handleDeleteWhitelistEntry = useCallback(
    async (entry: WhitelistEntry) => {
      if (!confirm(t('admin.members.allowlistDeleteConfirm'))) {
        return;
      }

      if (isDemo) {
        setWhitelistEntries((prev) => prev.filter((item) => item.id !== entry.id));
        return;
      }

      const { error: deleteError } = await supabase.from('membership_whitelist').delete().eq('id', entry.id);

      if (deleteError) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: deleteError.message }) });
      } else {
        await loadWhitelist();
        setMessage({ type: 'success', text: t('admin.messages.success') });
      }
    },
    [formatMessage, isDemo, loadWhitelist, t]
  );

  const handleAddBranch = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isDemo) {
        setMessage({ type: 'success', text: t('admin.messages.success') });
        return;
      }

      const { error: insertError } = await supabase.from('branches').insert([
        {
          ...newBranch,
          active: true,
        },
      ]);

      if (insertError) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: insertError.message }) });
      } else {
        setMessage({ type: 'success', text: t('admin.messages.success') });
        setNewBranch({ name: '', location: '', discount_percentage: 10 });
        await loadBranches();
      }
    },
    [formatMessage, isDemo, loadBranches, newBranch, t]
  );

  const handleToggleBranch = useCallback(
    async (branch: BranchRow) => {
      if (isDemo) {
        setBranches((prev) =>
          prev.map((entry) => (entry.id === branch.id ? { ...entry, active: !entry.active } : entry))
        );
        return;
      }

      const { error: updateError } = await supabase
        .from('branches')
        .update({ active: !branch.active })
        .eq('id', branch.id);

      if (updateError) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: updateError.message }) });
      } else {
        await loadBranches();
      }
    },
    [formatMessage, isDemo, loadBranches]
  );

  const handleStartBranchEdit = useCallback((branch: BranchRow) => {
    setEditingBranchId(branch.id);
    setBranchDraft({
      name: branch.name,
      location: branch.location ?? '',
      discount_percentage: branch.discount_percentage,
      active: branch.active,
    });
  }, []);

  const handleCancelBranchEdit = useCallback(() => {
    setEditingBranchId(null);
    setBranchDraft({ name: '', location: '', discount_percentage: 10, active: true });
  }, []);

  const handleBranchDraftChange = useCallback(
    <K extends keyof typeof branchDraft>(field: K, value: (typeof branchDraft)[K]) => {
      setBranchDraft((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSaveBranchEdit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!editingBranchId) {
        return;
      }

      if (isDemo) {
        setBranches((prev) =>
          prev.map((entry) =>
            entry.id === editingBranchId
              ? {
                  ...entry,
                  name: branchDraft.name,
                  location: branchDraft.location,
                  discount_percentage: branchDraft.discount_percentage,
                  active: branchDraft.active,
                }
              : entry
          )
        );
        handleCancelBranchEdit();
        return;
      }

      setIsSavingBranch(true);

      const { error: updateError } = await supabase
        .from('branches')
        .update({
          name: branchDraft.name,
          location: branchDraft.location || null,
          discount_percentage: branchDraft.discount_percentage,
          active: branchDraft.active,
        })
        .eq('id', editingBranchId);

      if (updateError) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: updateError.message }) });
      } else {
        await loadBranches();
        handleCancelBranchEdit();
        setMessage({ type: 'success', text: t('admin.messages.success') });
      }

      setIsSavingBranch(false);
    },
    [branchDraft, editingBranchId, formatMessage, handleCancelBranchEdit, isDemo, loadBranches, t]
  );

  const handleOfferFieldChange = useCallback(
    <K extends keyof PartnerOfferFormState>(field: K, value: PartnerOfferFormState[K]) => {
      setNewOffer((prev) => {
        if (field === 'scope') {
          const nextScope = value as PartnerScope;
          const nextBranch = nextScope === 'local' ? prev.branchId || branches[0]?.id || '' : '';
          return { ...prev, scope: nextScope, branchId: nextBranch };
        }
        return { ...prev, [field]: value };
      });
      setOfferErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [branches]
  );

  const handleOfferDraftChange = useCallback(
    <K extends keyof PartnerOfferDraft>(field: K, value: PartnerOfferDraft[K]) => {
      setOfferDraft((prev) => ({ ...prev, [field]: value }));
      const resettableFields: (keyof PartnerOfferFormErrors)[] = [
        'title',
        'description',
        'discountCode',
        'discountPercentage',
        'scope',
        'branchId',
        'city',
      ];
      if (resettableFields.includes(field as keyof PartnerOfferFormErrors)) {
        setOfferErrors((prev) => ({ ...prev, [field as keyof PartnerOfferFormErrors]: undefined }));
      }
    },
    []
  );

  const handleAddOffer = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isDemo) {
        setMessage({ type: 'success', text: t('admin.messages.success') });
        return;
      }

      const allowNational = isCouncil;
      const effectiveScope: PartnerScope = allowNational ? newOffer.scope : 'local';
      const branchForLocal = effectiveScope === 'local' ? (allowNational ? newOffer.branchId : memberBranchId) : null;

      const validation = preparePartnerOfferPayload(newOffer, {
        scope: effectiveScope,
        branchId: branchForLocal,
        allowNational,
      });

      setOfferErrors(validation.errors);

      if (!validation.payload || !user) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: 'validation' }) });
        return;
      }

      setIsSavingOffer(true);
      const payload = {
        ...validation.payload,
        active: true,
        created_by: user.id,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from('partner_offers').insert([payload]);

      if (insertError) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: insertError.message }) });
      } else {
        setMessage({ type: 'success', text: t('admin.messages.success') });
        setNewOffer({
          title: '',
          description: '',
          discountCode: '',
          discountPercentage: 10,
          scope: allowNational ? newOffer.scope : 'local',
          branchId: allowNational ? (branchForLocal ?? '') : '',
          city: '',
        });
        setOfferErrors({});
        await loadPartnerOffers();
      }
      setIsSavingOffer(false);
    },
    [formatMessage, isCouncil, isDemo, loadPartnerOffers, memberBranchId, newOffer, t, user]
  );

  const handleStartOfferEdit = useCallback(
    (offer: PartnerOfferRecord) => {
      setEditingOfferId(offer.id);
      setOfferDraft({
        id: offer.id,
        title: offer.title ?? '',
        description: offer.description ?? '',
        discountCode: offer.discount_code ?? '',
        discountPercentage: offer.discount_percentage ?? 0,
        scope: offer.scope,
        branchId: offer.branch_id ?? '',
        city: offer.city ?? '',
        active: offer.active ?? true,
      });
      setOfferErrors({});
    },
    []
  );

  const handleCancelOfferEdit = useCallback(() => {
    setEditingOfferId(null);
    setOfferDraft({
      id: undefined,
      title: '',
      description: '',
      discountCode: '',
      discountPercentage: 10,
      scope: 'national',
      branchId: '',
      city: '',
      active: true,
    });
  }, []);

  const handleSaveOfferEdit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!editingOfferId) {
        return;
      }

      if (isDemo) {
        setPartnerOffers((prev) =>
          prev.map((entry) =>
            entry.id === editingOfferId
              ? {
                  ...entry,
                  title: offerDraft.title,
                  description: offerDraft.description,
                  discount_code: offerDraft.discountCode,
                  discount_percentage: offerDraft.discountPercentage,
                  scope: offerDraft.scope,
                  branch_id: offerDraft.scope === 'local' ? offerDraft.branchId : null,
                  city: offerDraft.city,
                  active: offerDraft.active,
                }
              : entry
          )
        );
        handleCancelOfferEdit();
        return;
      }

      const allowNational = isCouncil;
      const effectiveScope: PartnerScope = allowNational ? offerDraft.scope : 'local';
      const branchForLocal =
        effectiveScope === 'local'
          ? (allowNational ? offerDraft.branchId : memberBranchId)
          : null;

      const validation = preparePartnerOfferPayload(
        {
          title: offerDraft.title,
          description: offerDraft.description,
          discountCode: offerDraft.discountCode,
          discountPercentage: offerDraft.discountPercentage,
          scope: offerDraft.scope,
          branchId: offerDraft.branchId,
          city: offerDraft.city,
        },
        {
          scope: effectiveScope,
          branchId: branchForLocal,
          allowNational,
        }
      );

      setOfferErrors(validation.errors);

      if (!validation.payload) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: 'validation' }) });
        return;
      }

      setIsSavingExistingOffer(true);

      const { error: updateError } = await supabase
        .from('partner_offers')
        .update({
          ...validation.payload,
          active: offerDraft.active,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        })
        .eq('id', editingOfferId);

      if (updateError) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: updateError.message }) });
      } else {
        await loadPartnerOffers();
        handleCancelOfferEdit();
        setMessage({ type: 'success', text: t('admin.messages.success') });
      }

      setIsSavingExistingOffer(false);
    },
    [
      editingOfferId,
      formatMessage,
      handleCancelOfferEdit,
      isCouncil,
      isDemo,
      loadPartnerOffers,
      memberBranchId,
      offerDraft,
      t,
      user?.id,
    ]
  );

  const handleToggleOffer = useCallback(
    async (offer: PartnerOfferRecord) => {
      if (isDemo) {
        setPartnerOffers((prev) =>
          prev.map((entry) => (entry.id === offer.id ? { ...entry, active: !entry.active } : entry))
        );
        return;
      }

      const { error: updateError } = await supabase
        .from('partner_offers')
        .update({ active: !offer.active, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
        .eq('id', offer.id);

      if (updateError) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: updateError.message }) });
      } else {
        await loadPartnerOffers();
      }
    },
    [formatMessage, isDemo, loadPartnerOffers, user?.id]
  );

  const handleDeleteOffer = useCallback(
    async (offerId: string) => {
      if (!confirm(t('admin.partners.deleteConfirm'))) {
        return;
      }

      if (isDemo) {
        setPartnerOffers((prev) => prev.filter((offer) => offer.id !== offerId));
        return;
      }

      const { error: deleteError } = await supabase.from('partner_offers').delete().eq('id', offerId);

      if (deleteError) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: deleteError.message }) });
      } else {
        await loadPartnerOffers();
      }
    },
    [formatMessage, isDemo, loadPartnerOffers, t]
  );

  const handleExportWhitelist = useCallback(() => {
    if (whitelistEntries.length === 0 || typeof window === 'undefined') {
      return;
    }

    const headers = ['Email', 'First name', 'Last name', 'Role', 'Branch ID', 'Status', 'Note'];
    const rows = whitelistEntries.map((entry) => {
      const status = entry.consumed_at
        ? 'consumed'
        : entry.active
        ? 'active'
        : 'paused';
      return [
        entry.email,
        entry.first_name ?? '',
        entry.last_name ?? '',
        entry.role,
        entry.branch_id ?? '',
        status,
        entry.note ?? '',
      ];
    });

    const csvContent = [headers, ...rows]
      .map((line) => line.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `membership-allowlist-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [whitelistEntries]);

  const handleEditNews = useCallback((item: NewsItem) => {
    setEditingNewsId(item.id);
    setNewsDraft({
      title: item.title,
      body: item.body,
      status: item.status,
      publishAt: item.publish_at ? item.publish_at.slice(0, 16) : '',
    });
  }, []);

  const handleCancelNewsEdit = useCallback(() => {
    setEditingNewsId(null);
    setNewsDraft({ title: '', body: '', status: 'draft', publishAt: '' });
  }, []);

  const handleNewsDraftChange = useCallback(
    <K extends keyof typeof newsDraft>(field: K, value: (typeof newsDraft)[K]) => {
      setNewsDraft((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const persistNews = useCallback(async () => {
    if (isDemo) {
      if (editingNewsId) {
        setNewsItems((prev) =>
          prev.map((entry) =>
            entry.id === editingNewsId
              ? {
                  ...entry,
                  title: newsDraft.title,
                  body: newsDraft.body,
                  status: newsDraft.status,
                  publish_at: newsDraft.publishAt ? new Date(newsDraft.publishAt).toISOString() : entry.publish_at,
                }
              : entry
          )
        );
      } else {
        setNewsItems((prev) => [
          {
            id: `demo-news-${Date.now()}`,
            title: newsDraft.title,
            body: newsDraft.body,
            status: newsDraft.status,
            publish_at: newsDraft.publishAt ? new Date(newsDraft.publishAt).toISOString() : new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: 'demo',
            updated_by: 'demo',
          },
          ...prev,
        ]);
      }
      handleCancelNewsEdit();
      return;
    }

    const publishAtValue = newsDraft.publishAt ? new Date(newsDraft.publishAt).toISOString() : null;
    const payload = {
      title: newsDraft.title,
      body: newsDraft.body,
      status: newsDraft.status,
      publish_at: publishAtValue,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    };

    if (editingNewsId) {
      const { error: updateError } = await supabase.from('news_items').update(payload).eq('id', editingNewsId);
      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      const { error: insertError } = await supabase
        .from('news_items')
        .insert([{ ...payload, created_at: new Date().toISOString(), created_by: user?.id ?? null }]);
      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    await loadNewsItems();
    handleCancelNewsEdit();
  }, [editingNewsId, handleCancelNewsEdit, isDemo, loadNewsItems, newsDraft, user?.id]);

  const handleSaveNews = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!newsDraft.title.trim() || !newsDraft.body.trim()) {
        setMessage({ type: 'error', text: formatMessage('admin.news.validation') });
        return;
      }

      setIsSavingNews(true);
      try {
        await persistNews();
        setMessage({ type: 'success', text: t('admin.messages.success') });
      } catch (saveError: unknown) {
        setMessage({
          type: 'error',
          text: formatMessage('admin.messages.error', {
            message: saveError instanceof Error ? saveError.message : 'news-save',
          }),
        });
      }
      setIsSavingNews(false);
    },
    [formatMessage, persistNews, t, newsDraft]
  );

  const handleDeleteNews = useCallback(
    async (newsId: string) => {
      if (!confirm(t('admin.news.deleteConfirm'))) {
        return;
      }

      if (isDemo) {
        setNewsItems((prev) => prev.filter((entry) => entry.id !== newsId));
        return;
      }

      const { error: deleteError } = await supabase.from('news_items').delete().eq('id', newsId);
      if (deleteError) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: deleteError.message }) });
      } else {
        await loadNewsItems();
      }
    },
    [formatMessage, isDemo, loadNewsItems, t]
  );

  const handlePublishNews = useCallback(
    async (item: NewsItem) => {
      if (isDemo) {
        setNewsItems((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: 'published', publish_at: new Date().toISOString() }
              : entry
          )
        );
        return;
      }

      const { error: publishError } = await supabase
        .from('news_items')
        .update({ status: 'published', publish_at: new Date().toISOString(), updated_by: user?.id ?? null })
        .eq('id', item.id);

      if (publishError) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: publishError.message }) });
      } else {
        await loadNewsItems();
      }
    },
    [formatMessage, isDemo, loadNewsItems, user?.id]
  );

  const allowlistTitle = formatMessage('admin.members.allowlistTitle', { count: whitelistEntries.length });
  const approvedTitle = formatMessage('admin.members.listTitle', { count: members.length });
  const branchesTitle = formatMessage('admin.branches.listTitle', { count: branches.length });
  const partnersTitle = formatMessage('admin.partners.listTitle', { count: partnerOffers.length });
  const overviewCards = useMemo<OverviewCard[]>(() => {
    if (activeTab === 'members') {
      const openInvites = whitelistEntries.filter((entry) => entry.active && !entry.consumed_at).length;
      const usedInvites = whitelistEntries.filter((entry) => entry.consumed_at).length;
      const pausedInvites = whitelistEntries.filter((entry) => !entry.active && !entry.consumed_at).length;
      return [
        { id: 'allowlist-open', icon: UserPlus, value: String(openInvites), label: t('admin.summary.allowlistOpen') },
        { id: 'allowlist-paused', icon: Mail, value: String(pausedInvites + usedInvites), label: t('admin.summary.allowlistOther') },
        { id: 'members', icon: UserCheck, value: String(members.length), label: t('admin.summary.approved') },
      ];
    }

    if (activeTab === 'branches') {
      const activeCount = branches.filter((branch) => branch.active).length;
      const coverage = branches.length === 0 ? 0 : Math.round((activeCount / branches.length) * 100);
      return [
        { id: 'active-branches', icon: MapPin, value: `${activeCount}/${branches.length}`, label: t('admin.summary.branchesActive') },
        { id: 'coverage', icon: BarChart3, value: `${coverage}%`, label: t('admin.summary.branchCoverage') },
      ];
    }

    if (activeTab === 'partners') {
      const activeCount = partnerOffers.filter((offer) => offer.active !== false).length;
      const inactiveCount = partnerOffers.length - activeCount;
      const nationalCount = partnerOffers.filter((offer) => offer.scope === 'national').length;
      return [
        { id: 'active-offers', icon: Tag, value: String(activeCount), label: t('admin.summary.partnerActive') },
        { id: 'inactive-offers', icon: ToggleRight, value: String(inactiveCount), label: t('admin.summary.partnerInactive') },
        { id: 'national-offers', icon: Globe2, value: String(nationalCount), label: t('admin.summary.partnerNational') },
      ];
    }

    if (activeTab === 'news') {
      const publishedCount = newsItems.filter((item) => item.status === 'published').length;
      const draftCount = newsItems.filter((item) => item.status === 'draft').length;
      const scheduledCount = newsItems.filter((item) => item.status === 'scheduled').length;
      return [
        { id: 'published-news', icon: Megaphone, value: String(publishedCount), label: t('admin.summary.newsPublished') },
        { id: 'draft-news', icon: FileText, value: String(draftCount), label: t('admin.summary.newsDrafts') },
        { id: 'scheduled-news', icon: CalendarClock, value: String(scheduledCount), label: t('admin.summary.newsScheduled') },
      ];
    }

    return [];
  }, [activeTab, branches, members.length, newsItems, partnerOffers, t, whitelistEntries]);
  const branchLookup = useMemo(() => {
    const map = new Map<string, BranchRow>();
    branches.forEach((branch) => map.set(branch.id, branch));
    return map;
  }, [branches]);
  const auditFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale]
  );

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card" style={{ color: colors.textSecondary }}>
            {t('admin.states.loading')}
          </div>
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card space-y-3">
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {t('admin.states.unauthorizedTitle')}
            </h2>
            <p style={{ color: colors.textSecondary }}>{t('admin.states.unauthorizedDescription')}</p>
          </div>
        </div>
        <Navigation userRole={memberRole} />
      </main>
    );
  }

  if (status === 'error' || !member) {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card space-y-3">
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {t('admin.states.unauthorizedTitle')}
            </h2>
            <p style={{ color: colors.textSecondary }}>{error ?? t('admin.states.loading')}</p>
            <button onClick={refresh} className="psychocas-button-primary w-max flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" /> {t('admin.states.refresh')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="psychocas-section pb-24">
      <div className="psychocas-container space-y-6 fade-in-up">
        <header className="space-y-1 pt-6">
          <h1>{t('admin.heading')}</h1>
          <p style={{ color: colors.textSecondary }}>{t('admin.subheading')}</p>
          {isDemo && (
            <p className="text-sm" style={{ color: colors.warning }}>{t('admin.states.demoNotice')}</p>
          )}
        </header>

        {message && (
          <div
            className="psychocas-card text-sm"
            style={{
              border: `1px solid ${message.type === 'error' ? colors.danger : colors.accent}`,
              color: message.type === 'error' ? colors.danger : colors.success,
              backgroundColor: message.type === 'error' ? colors.dangerSurface : colors.successSurface,
            }}
          >
            {message.text}
          </div>
        )}

        <nav className="flex flex-wrap gap-3">
        {(['members', 'branches', 'partners', 'news'] as AdminTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-3 py-2 rounded-full border text-sm font-medium"
              style={{
                backgroundColor: activeTab === tab ? colors.brandPrimary : colors.background,
                color: activeTab === tab ? colors.background : colors.textSecondary,
                borderColor: activeTab === tab ? colors.brandPrimary : colors.border,
              }}
            >
              {t(`admin.tabs.${tab}`)}
            </button>
          ))}
        </nav>

        {overviewCards.length > 0 && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {overviewCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.id} className="psychocas-card flex items-center gap-3">
                  <div className="rounded-full p-3" style={{ backgroundColor: colors.brandSurface }}>
                    <Icon className="h-5 w-5" style={{ color: colors.brandPrimary }} />
                  </div>
                  <div>
                    <div className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
                      {card.value}
                    </div>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      {card.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {activeTab === 'members' && (
          <section className="space-y-6">
            <div className="psychocas-card space-y-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-full p-2" style={{ backgroundColor: colors.brandSurface }}>
                    <Users className="h-5 w-5" style={{ color: colors.brandPrimary }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                      {allowlistTitle}
                    </h2>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      {t('admin.members.allowlistDescription')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleExportWhitelist}
                  className="psychocas-button-tertiary flex items-center gap-2 text-sm"
                  disabled={whitelistEntries.length === 0}
                  type="button"
                >
                  <Download className="h-4 w-4" />
                  {t('admin.members.export')}
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleCreateWhitelistEntry}>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="email"
                    className="psychocas-input md:col-span-2"
                    placeholder={t('admin.members.allowlistForm.email')}
                    value={whitelistForm.email}
                    onChange={(event) => handleWhitelistFieldChange('email', event.target.value)}
                    required
                  />
                  <input
                    className="psychocas-input"
                    placeholder={t('admin.members.allowlistForm.firstName')}
                    value={whitelistForm.firstName}
                    onChange={(event) => handleWhitelistFieldChange('firstName', event.target.value)}
                  />
                  <input
                    className="psychocas-input"
                    placeholder={t('admin.members.allowlistForm.lastName')}
                    value={whitelistForm.lastName}
                    onChange={(event) => handleWhitelistFieldChange('lastName', event.target.value)}
                  />
                  <input
                    className="psychocas-input"
                    placeholder={t('admin.members.allowlistForm.phone')}
                    value={whitelistForm.phone}
                    onChange={(event) => handleWhitelistFieldChange('phone', event.target.value)}
                  />
                  <select
                    className="psychocas-input"
                    value={whitelistForm.role}
                    onChange={(event) => handleWhitelistFieldChange('role', event.target.value as MemberRole)}
                    aria-label={t('admin.members.allowlistForm.role')}
                  >
                    {(['member', 'manager', 'council', 'technician', 'admin'] as MemberRole[]).map((role) => (
                      <option key={role} value={role}>
                        {t(`technician.roleLabels.${role}` as const)}
                      </option>
                    ))}
                  </select>
                  <select
                    className="psychocas-input"
                    value={whitelistForm.branchId}
                    onChange={(event) => handleWhitelistFieldChange('branchId', event.target.value)}
                    aria-label={t('admin.members.allowlistForm.branch')}
                  >
                    <option value="">{t('admin.members.allowlistForm.branchNone')}</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                  <textarea
                    className="psychocas-input md:col-span-2"
                    placeholder={t('admin.members.allowlistForm.note')}
                    value={whitelistForm.note}
                    onChange={(event) => handleWhitelistFieldChange('note', event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="submit"
                    className="psychocas-button-primary flex items-center gap-2"
                    disabled={isSavingWhitelist}
                  >
                    <UserPlus className="h-4 w-4" />
                    {t('admin.members.allowlistForm.submit')}
                  </button>
                  <p className="text-xs" style={{ color: colors.textSecondary }}>
                    {t('admin.members.allowlistHint')}
                  </p>
                </div>
              </form>

              {whitelistEntries.length === 0 ? (
                <p style={{ color: colors.textSecondary }}>{t('admin.members.allowlistEmpty')}</p>
              ) : (
                <div className="space-y-3">
                  {whitelistEntries.map((entry) => {
                    const fullName = `${entry.first_name ?? ''} ${entry.last_name ?? ''}`.trim();
                    const statusKey = entry.consumed_at ? 'consumed' : entry.active ? 'active' : 'paused';
                    const statusColor = entry.consumed_at
                      ? colors.success
                      : entry.active
                      ? colors.brandPrimary
                      : colors.textSecondary;
                    const branchName = entry.branch_id ? branchLookup.get(entry.branch_id)?.name ?? null : null;
                    return (
                      <div key={entry.id} className="rounded-lg border p-4" style={{ borderColor: colors.border }}>
                        <div className="flex flex-col gap-4 md:flex-row md:justify-between">
                          <div className="space-y-2" style={{ color: colors.textPrimary }}>
                            <div className="font-medium">{fullName || entry.email}</div>
                            <div className="text-sm" style={{ color: colors.textSecondary }}>
                              <Mail className="mr-1 inline h-4 w-4" />
                              {entry.email}
                            </div>
                            {entry.phone && (
                              <div className="text-sm" style={{ color: colors.textSecondary }}>
                                <Phone className="mr-1 inline h-4 w-4" />
                                {entry.phone}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
                              <span style={{ color: statusColor }}>
                                {t(`admin.members.allowlistStatus.${statusKey}` as const)}
                              </span>
                              <span style={{ color: colors.textSecondary }}>
                                {t(`technician.roleLabels.${entry.role}` as const)}
                              </span>
                              {branchName && (
                                <span style={{ color: colors.textSecondary }}>{branchName}</span>
                              )}
                            </div>
                            <div className="text-xs" style={{ color: colors.textSecondary }}>
                              {t('admin.members.allowlistInvitedAt', {
                                date: auditFormatter.format(new Date(entry.invited_at)),
                              })}
                            </div>
                            {entry.consumed_at && (
                              <div className="text-xs" style={{ color: colors.success }}>
                                {t('admin.members.allowlistConsumedAt', {
                                  date: auditFormatter.format(new Date(entry.consumed_at)),
                                })}
                              </div>
                            )}
                            {entry.note && (
                              <div className="text-sm italic" style={{ color: colors.textSecondary }}>
                                {entry.note}
                              </div>
                            )}
                          </div>
                          {!entry.consumed_at && (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                              <button
                                type="button"
                                onClick={() => void handleToggleWhitelistEntry(entry)}
                                className="psychocas-button-secondary flex items-center gap-2"
                              >
                                <ToggleRight className="h-4 w-4" />
                                {t(
                                  entry.active
                                    ? 'admin.members.allowlistPause'
                                    : 'admin.members.allowlistResume'
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteWhitelistEntry(entry)}
                                className="psychocas-button-tertiary flex items-center gap-2"
                              >
                                <Trash2 className="h-4 w-4" />
                                {t('admin.members.allowlistDelete')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="psychocas-card space-y-3">
              <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{approvedTitle}</h2>
              {members.length === 0 ? (
                <p style={{ color: colors.textSecondary }}>{t('admin.members.listEmpty')}</p>
              ) : (
                <div className="space-y-3">
                  {members.map((item) => (
                    <div key={item.user_id} className="rounded-lg border p-4" style={{ borderColor: colors.border }}>
                      <div className="flex flex-col gap-2">
                        <div className="font-medium" style={{ color: colors.textPrimary }}>
                          {item.full_name ?? item.email}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide">
                          <span style={{ color: item.membership_active ? colors.success : colors.textSecondary }}>
                            {item.membership_active
                              ? t('admin.members.memberStatus.active')
                              : t('admin.members.memberStatus.inactive')}
                          </span>
                          <span style={{ color: colors.textSecondary }}>
                            {t(`technician.roleLabels.${item.role}` as const)}
                          </span>
                        </div>
                        <div className="text-sm" style={{ color: colors.textSecondary }}>
                          <Mail className="mr-1 inline h-4 w-4" />
                          {item.email}
                        </div>
                        {item.phone && (
                          <div className="text-sm" style={{ color: colors.textSecondary }}>
                            <Phone className="mr-1 inline h-4 w-4" />
                            {item.phone}
                          </div>
                        )}
                        {item.membership_expires && (
                          <div className="text-sm" style={{ color: colors.textSecondary }}>
                            <CalendarClock className="mr-1 inline h-4 w-4" />
                            {t('admin.members.expiresOn', {
                              date: new Intl.DateTimeFormat(locale).format(new Date(item.membership_expires)),
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'branches' && (
          <section className="space-y-6">
            <form className="psychocas-card space-y-3" onSubmit={handleAddBranch}>
              <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{t('admin.branches.formTitle')}</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  className="psychocas-input"
                  placeholder={t('admin.branches.name')}
                  value={newBranch.name}
                  onChange={(event) => setNewBranch((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
                <input
                  className="psychocas-input"
                  placeholder={t('admin.branches.location')}
                  value={newBranch.location}
                  onChange={(event) => setNewBranch((prev) => ({ ...prev, location: event.target.value }))}
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="psychocas-input"
                  placeholder={t('admin.branches.discount')}
                  value={newBranch.discount_percentage}
                  onChange={(event) =>
                    setNewBranch((prev) => ({ ...prev, discount_percentage: Number(event.target.value) || 0 }))
                  }
                />
              </div>
              <button type="submit" className="psychocas-button-primary w-max">
                {t('admin.branches.submit')}
              </button>
            </form>

            <div className="psychocas-card space-y-3">
              <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{branchesTitle}</h2>
              {branches.length === 0 ? (
                <p style={{ color: colors.textSecondary }}>{t('admin.branches.empty')}</p>
              ) : (
                <div className="space-y-3">
                  {branches.map((branch) => (
                    <div key={branch.id} className="rounded-lg border p-4" style={{ borderColor: colors.border }}>
                      {editingBranchId === branch.id ? (
                        <form className="space-y-3" onSubmit={handleSaveBranchEdit}>
                          <div className="grid gap-3 md:grid-cols-2">
                            <input
                              className="psychocas-input"
                              value={branchDraft.name}
                              onChange={(event) => handleBranchDraftChange('name', event.target.value)}
                              required
                              placeholder={t('admin.branches.name')}
                            />
                            <input
                              className="psychocas-input"
                              value={branchDraft.location}
                              onChange={(event) => handleBranchDraftChange('location', event.target.value)}
                              placeholder={t('admin.branches.location')}
                            />
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="psychocas-input"
                              value={branchDraft.discount_percentage}
                              onChange={(event) =>
                                handleBranchDraftChange(
                                  'discount_percentage',
                                  Number(event.target.value) || 0
                                )
                              }
                              placeholder={t('admin.branches.discount')}
                            />
                            <label className="flex items-center gap-2 text-sm" style={{ color: colors.textSecondary }}>
                              <input
                                type="checkbox"
                                checked={branchDraft.active}
                                onChange={(event) => handleBranchDraftChange('active', event.target.checked)}
                              />
                              {t('admin.branches.editActive')}
                            </label>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="submit"
                              className="psychocas-button-primary flex items-center gap-2"
                              disabled={isSavingBranch}
                            >
                              <Save className="h-4 w-4" />
                              {t('admin.branches.save')}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelBranchEdit}
                              className="psychocas-button-secondary flex items-center gap-2"
                            >
                              <X className="h-4 w-4" />
                              {t('admin.branches.cancel')}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="font-medium" style={{ color: colors.textPrimary }}>{branch.name}</div>
                            <div className="text-sm" style={{ color: colors.textSecondary }}>
                              {branch.location ?? '—'} · {branch.discount_percentage}%
                            </div>
                            <div className="text-xs font-semibold uppercase" style={{ color: colors.textSecondary }}>
                              {branch.active
                                ? t('admin.branches.status.active')
                                : t('admin.branches.status.inactive')}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => handleStartBranchEdit(branch)}
                              className="psychocas-button-tertiary flex items-center gap-2"
                              type="button"
                            >
                              <Edit3 className="h-4 w-4" />
                              {t('admin.branches.edit')}
                            </button>
                            <button
                              onClick={() => void handleToggleBranch(branch)}
                              className="psychocas-button-secondary flex items-center gap-2"
                            >
                              <ToggleRight className="h-4 w-4" />
                              {t('admin.branches.toggleActive')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'partners' && (
          <section className="space-y-6">
            <form className="psychocas-card space-y-3" onSubmit={handleAddOffer}>
              <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{t('admin.partners.formTitle')}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="psychocas-input md:col-span-2"
                  placeholder={t('admin.partners.form.title')}
                  value={newOffer.title}
                  onChange={(event) => handleOfferFieldChange('title', event.target.value)}
                  required
                />
                <textarea
                  className="psychocas-input md:col-span-2"
                  placeholder={t('admin.partners.form.description')}
                  value={newOffer.description}
                  onChange={(event) => handleOfferFieldChange('description', event.target.value)}
                  required
                />
                <input
                  className="psychocas-input"
                  placeholder={t('admin.partners.form.discountCode')}
                  value={newOffer.discountCode}
                  onChange={(event) => handleOfferFieldChange('discountCode', event.target.value)}
                />
                <input
                  type="number"
                  className="psychocas-input"
                  placeholder={t('admin.partners.form.discountPercentage')}
                  value={newOffer.discountPercentage}
                  onChange={(event) => handleOfferFieldChange('discountPercentage', Number(event.target.value) || 0)}
                />
                {isCouncil && (
                  <select
                    className="psychocas-input"
                    value={newOffer.scope}
                    onChange={(event) => handleOfferFieldChange('scope', event.target.value as PartnerScope)}
                  >
                    <option value="national">{t('admin.partners.form.scopeOptions.national')}</option>
                    <option value="local">{t('admin.partners.form.scopeOptions.local')}</option>
                  </select>
                )}
                {(isCouncil || newOffer.scope === 'local') && (
                  <select
                    className="psychocas-input"
                    value={newOffer.branchId}
                    onChange={(event) => handleOfferFieldChange('branchId', event.target.value)}
                  >
                    <option value="">{t('admin.partners.form.branch')}</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  className="psychocas-input"
                  placeholder={t('admin.partners.form.city')}
                  value={newOffer.city}
                  onChange={(event) => handleOfferFieldChange('city', event.target.value)}
                />
              </div>
              {Object.values(offerErrors).some(Boolean) && (
                <p className="text-sm" style={{ color: colors.danger }}>
                  {t('admin.messages.errorGeneric')}
                </p>
              )}
              <button type="submit" className="psychocas-button-primary w-max" disabled={isSavingOffer}>
                {t('admin.partners.form.submit')}
              </button>
            </form>

            <div className="psychocas-card space-y-3">
              <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{partnersTitle}</h2>
              {partnerOffers.length === 0 ? (
                <p style={{ color: colors.textSecondary }}>{t('admin.partners.empty')}</p>
              ) : (
                <div className="space-y-3">
                  {partnerOffers.map((offer) => (
                    <div key={offer.id} className="rounded-lg border p-4" style={{ borderColor: colors.border }}>
                      {editingOfferId === offer.id ? (
                        <form className="space-y-3" onSubmit={handleSaveOfferEdit}>
                          <div className="grid gap-3 md:grid-cols-2">
                            <input
                              className="psychocas-input md:col-span-2"
                              value={offerDraft.title}
                              onChange={(event) => handleOfferDraftChange('title', event.target.value)}
                              required
                              placeholder={t('admin.partners.form.title')}
                            />
                            <textarea
                              className="psychocas-input md:col-span-2"
                              value={offerDraft.description}
                              onChange={(event) => handleOfferDraftChange('description', event.target.value)}
                              required
                              placeholder={t('admin.partners.form.description')}
                            />
                            <input
                              className="psychocas-input"
                              value={offerDraft.discountCode}
                              onChange={(event) => handleOfferDraftChange('discountCode', event.target.value)}
                              placeholder={t('admin.partners.form.discountCode')}
                            />
                            <input
                              type="number"
                              className="psychocas-input"
                              value={offerDraft.discountPercentage}
                              onChange={(event) =>
                                handleOfferDraftChange('discountPercentage', Number(event.target.value) || 0)
                              }
                              placeholder={t('admin.partners.form.discountPercentage')}
                            />
                            {(isCouncil || offerDraft.scope === 'local') && (
                              <select
                                className="psychocas-input"
                                value={offerDraft.branchId}
                                onChange={(event) => handleOfferDraftChange('branchId', event.target.value)}
                              >
                                <option value="">{t('admin.partners.form.branch')}</option>
                                {branches.map((branch) => (
                                  <option key={branch.id} value={branch.id}>
                                    {branch.name}
                                  </option>
                                ))}
                              </select>
                            )}
                            {isCouncil && (
                              <select
                                className="psychocas-input"
                                value={offerDraft.scope}
                                onChange={(event) => handleOfferDraftChange('scope', event.target.value as PartnerScope)}
                              >
                                <option value="national">{t('admin.partners.form.scopeOptions.national')}</option>
                                <option value="local">{t('admin.partners.form.scopeOptions.local')}</option>
                              </select>
                            )}
                            <input
                              className="psychocas-input"
                              value={offerDraft.city}
                              onChange={(event) => handleOfferDraftChange('city', event.target.value)}
                              placeholder={t('admin.partners.form.city')}
                            />
                            <label className="flex items-center gap-2 text-sm" style={{ color: colors.textSecondary }}>
                              <input
                                type="checkbox"
                                checked={offerDraft.active}
                                onChange={(event) => handleOfferDraftChange('active', event.target.checked)}
                              />
                              {t('admin.partners.editActive')}
                            </label>
                          </div>
                          {Object.values(offerErrors).some(Boolean) && (
                            <p className="text-sm" style={{ color: colors.danger }}>
                              {t('admin.messages.errorGeneric')}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="submit"
                              className="psychocas-button-primary flex items-center gap-2"
                              disabled={isSavingExistingOffer}
                            >
                              <Save className="h-4 w-4" />
                              {t('admin.partners.save')}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelOfferEdit}
                              className="psychocas-button-secondary flex items-center gap-2"
                            >
                              <X className="h-4 w-4" />
                              {t('admin.partners.cancel')}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-2">
                              <div className="font-medium" style={{ color: colors.textPrimary }}>{offer.title}</div>
                              <div className="text-sm" style={{ color: colors.textSecondary }}>{offer.description}</div>
                              <div className="text-sm" style={{ color: colors.textSecondary }}>
                                <Tag className="mr-1 inline h-4 w-4" />
                                {offer.discount_code || '—'} · {offer.discount_percentage ?? 0}%
                              </div>
                              <div className="text-xs font-semibold uppercase" style={{ color: colors.textSecondary }}>
                                {offer.active === false
                                  ? t('admin.partners.status.inactive')
                                  : t('admin.partners.status.active')}
                                {' · '}
                                {offer.scope === 'national'
                                  ? t('admin.partners.scope.national')
                                  : t('admin.partners.scope.local', {
                                      branch: offer.branch?.name ?? t('admin.partners.scope.noBranch'),
                                    })}
                              </div>
                              <div className="text-xs" style={{ color: colors.textSecondary }}>
                                {offer.updated_at
                                  ? formatMessage('admin.partners.audit.updated', {
                                      date: auditFormatter.format(new Date(offer.updated_at)),
                                    })
                                  : offer.created_at
                                  ? formatMessage('admin.partners.audit.created', {
                                      date: auditFormatter.format(new Date(offer.created_at)),
                                    })
                                  : null}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => handleStartOfferEdit(offer)}
                                className="psychocas-button-tertiary flex items-center gap-2"
                                type="button"
                              >
                                <Edit3 className="h-4 w-4" />
                                {t('admin.partners.edit')}
                              </button>
                              <button
                                onClick={() => void handleToggleOffer(offer)}
                                className="psychocas-button-secondary flex items-center gap-2"
                              >
                                <ToggleRight className="h-4 w-4" />
                                {t('admin.partners.toggle')}
                              </button>
                              <button
                                onClick={() => void handleDeleteOffer(offer.id)}
                                className="psychocas-button-secondary flex items-center gap-2"
                              >
                                <Trash2 className="h-4 w-4" />
                                {t('admin.partners.delete')}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'news' && (
          <section className="space-y-6">
            <form className="psychocas-card space-y-4" onSubmit={handleSaveNews}>
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5" style={{ color: colors.brandPrimary }} />
                <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                  {editingNewsId ? t('admin.news.editTitle') : t('admin.news.formTitle')}
                </h2>
              </div>
              <input
                className="psychocas-input"
                placeholder={t('admin.news.form.title')}
                value={newsDraft.title}
                onChange={(event) => handleNewsDraftChange('title', event.target.value)}
                required
              />
              <textarea
                className="psychocas-input"
                placeholder={t('admin.news.form.body')}
                value={newsDraft.body}
                onChange={(event) => handleNewsDraftChange('body', event.target.value)}
                rows={4}
                required
              />
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  className="psychocas-input"
                  value={newsDraft.status}
                  onChange={(event) => handleNewsDraftChange('status', event.target.value as NewsItem['status'])}
                >
                  <option value="draft">{t('admin.news.status.draft')}</option>
                  <option value="scheduled">{t('admin.news.status.scheduled')}</option>
                  <option value="published">{t('admin.news.status.published')}</option>
                </select>
                <input
                  type="datetime-local"
                  className="psychocas-input"
                  value={newsDraft.publishAt}
                  onChange={(event) => handleNewsDraftChange('publishAt', event.target.value)}
                  placeholder={t('admin.news.form.publishAt')}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="psychocas-button-primary flex items-center gap-2" disabled={isSavingNews}>
                  <Save className="h-4 w-4" />
                  {t('admin.news.save')}
                </button>
                {editingNewsId && (
                  <button
                    type="button"
                    onClick={handleCancelNewsEdit}
                    className="psychocas-button-secondary flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    {t('admin.news.cancel')}
                  </button>
                )}
              </div>
            </form>

            <div className="psychocas-card space-y-3">
              <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                {t('admin.news.listTitle', { count: newsItems.length })}
              </h2>
              {newsItems.length === 0 ? (
                <p style={{ color: colors.textSecondary }}>{t('admin.news.empty')}</p>
              ) : (
                <div className="space-y-3">
                  {newsItems.map((item) => {
                    const statusTone =
                      item.status === 'published'
                        ? { background: colors.successSurface, color: colors.success }
                        : item.status === 'scheduled'
                        ? { background: colors.warningSurface, color: colors.warning }
                        : { background: colors.brandSurfaceAlt, color: colors.brandPrimary };
                    return (
                      <div key={item.id} className="rounded-lg border p-4" style={{ borderColor: colors.border }}>
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium" style={{ color: colors.textPrimary }}>
                                {item.title}
                              </span>
                              <span
                                className="rounded-full px-2 py-1 text-xs font-semibold"
                                style={{ backgroundColor: statusTone.background, color: statusTone.color }}
                              >
                                {t(`admin.news.status.${item.status}` as const)}
                              </span>
                            </div>
                            <p className="text-sm" style={{ color: colors.textSecondary }}>
                              {item.body}
                            </p>
                            <div className="text-xs" style={{ color: colors.textSecondary }}>
                              {item.publish_at
                                ? formatMessage('admin.news.publishedAt', {
                                    date: auditFormatter.format(new Date(item.publish_at)),
                                  })
                                : t('admin.news.noPublishDate')}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => handleEditNews(item)}
                              className="psychocas-button-tertiary flex items-center gap-2"
                              type="button"
                            >
                              <Edit3 className="h-4 w-4" />
                              {t('admin.news.edit')}
                            </button>
                            <button
                              onClick={() => void handlePublishNews(item)}
                              className="psychocas-button-secondary flex items-center gap-2"
                              disabled={item.status === 'published'}
                            >
                              <CalendarClock className="h-4 w-4" />
                              {t('admin.news.publish')}
                            </button>
                            <button
                              onClick={() => void handleDeleteNews(item.id)}
                              className="psychocas-button-secondary flex items-center gap-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              {t('admin.news.delete')}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <Navigation userRole={memberRole} />
    </main>
  );
}
