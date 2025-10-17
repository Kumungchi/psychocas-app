'use client';

import { useCallback, useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import useMemberContext from '@/hooks/useMemberContext';
import useLocale from '@/hooks/useLocale';
import { supabase } from '@/lib/supabaseClient';
import {
  Users,
  UserCheck,
  UserX,
  Mail,
  Phone,
  MapPin,
  RefreshCcw,
  ToggleRight,
  Tag,
  Trash2,
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

interface TrustedUserRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string;
  branch_id: string | null;
  branch?: { id: string; name: string | null } | null;
  notes: string | null;
  added_at: string;
}

interface BranchRow {
  id: string;
  name: string;
  location: string | null;
  discount_percentage: number;
  active: boolean;
}

type AdminTab = 'members' | 'trusted' | 'branches' | 'partners';

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

const demoPendingMembers: AdminMember[] = [
  {
    user_id: 'demo-2',
    email: 'pending@psychocas.cz',
    full_name: 'Čekající Člen',
    role: 'member',
    membership_active: false,
    membership_expires: null,
    approved: false,
    approved_at: null,
    phone: null,
  },
];

const demoTrusted: TrustedUserRow[] = [
  {
    id: 'demo-trusted',
    email: 'trusted@demo.cz',
    first_name: 'Demo',
    last_name: 'Trusted',
    phone: null,
    role: 'manager',
    branch_id: null,
    branch: null,
    notes: 'Ukázkový přístup',
    added_at: new Date().toISOString(),
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

export default function AdminPage() {
  const { t, formatMessage, locale } = useLocale();
  const { status, member, user, error, refresh } = useMemberContext({ scope: 'admin-page' });
  const memberRole = member?.role ?? 'member';
  const isCouncil = memberRole === 'council';
  const isPsychocasManager = memberRole === 'manager' && Boolean(member?.email?.toLowerCase().endsWith('@psychocas.cz'));
  const canAccess = isCouncil || isPsychocasManager;
  const isDemo = member?.origin === 'demo';

  const [activeTab, setActiveTab] = useState<AdminTab>('members');

  const [members, setMembers] = useState<AdminMember[]>([]);
  const [pendingMembers, setPendingMembers] = useState<AdminMember[]>([]);
  const [trustedUsers, setTrustedUsers] = useState<TrustedUserRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [partnerOffers, setPartnerOffers] = useState<PartnerOfferRecord[]>([]);

  const [newTrusted, setNewTrusted] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'member',
    branch_id: '',
    notes: '',
  });
  const [newBranch, setNewBranch] = useState({
    name: '',
    location: '',
    discount_percentage: 10,
  });
  const [newOffer, setNewOffer] = useState<PartnerOfferFormState>({
    title: '',
    description: '',
    discountCode: '',
    discountPercentage: 10,
    scope: 'national',
    branchId: '',
    city: '',
  });
  const [offerErrors, setOfferErrors] = useState<PartnerOfferFormErrors>({});
  const [isSavingOffer, setIsSavingOffer] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadMembers = useCallback(async () => {
    if (isDemo) {
      setMembers(demoMembers);
      setPendingMembers(demoPendingMembers);
      return;
    }

    const { data } = await supabase
      .from('members')
      .select('user_id, email, full_name, role, membership_active, membership_expires, approved, approved_at, phone')
      .order('created_at', { ascending: false });

    if (data) {
      const normalized = (data as AdminMember[]).map((entry) => ({
        ...entry,
        role: (entry.role ?? 'member') as MemberRole,
      }));
      setMembers(normalized.filter((item) => item.approved));
      setPendingMembers(normalized.filter((item) => !item.approved));
    }
  }, [isDemo]);

  const loadTrusted = useCallback(async () => {
    if (isDemo) {
      setTrustedUsers(demoTrusted);
      return;
    }

    const { data } = await supabase
      .from('trusted_users')
      .select('id, email, first_name, last_name, phone, role, branch_id, branch:branch_id (id, name), notes, added_at')
      .order('added_at', { ascending: false });

    if (data) {
      setTrustedUsers((data as TrustedUserRow[]).map((row) => ({
        ...row,
        branch: Array.isArray(row.branch) ? row.branch?.[0] ?? null : row.branch ?? null,
      })));
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

  useEffect(() => {
    if (!canAccess || status !== 'ready') {
      return;
    }

    void Promise.all([loadMembers(), loadTrusted(), loadBranches(), loadPartnerOffers()]);
  }, [canAccess, loadBranches, loadMembers, loadPartnerOffers, loadTrusted, status]);

  const approveMember = useCallback(
    async (memberId: string) => {
      if (isDemo) {
        setMessage({ type: 'success', text: t('admin.members.approveSuccess') });
        return;
      }

      if (!user) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: 'missing-user' }) });
        return;
      }

      const { error: approveError } = await supabase.rpc('approve_member', {
        member_user_id: memberId,
        approver_user_id: user.id,
      });

      if (approveError) {
        setMessage({
          type: 'error',
          text: formatMessage('admin.members.approveError', { message: approveError.message }),
        });
      } else {
        setMessage({ type: 'success', text: t('admin.members.approveSuccess') });
        await loadMembers();
      }
    },
    [isDemo, loadMembers, t, formatMessage, user]
  );

  const handleAddTrusted = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isDemo) {
        setMessage({ type: 'success', text: t('admin.messages.success') });
        return;
      }

      const { error: insertError } = await supabase.from('trusted_users').insert([
        {
          ...newTrusted,
          branch_id: newTrusted.branch_id || null,
          added_by: user?.id ?? null,
        },
      ]);

      if (insertError) {
        setMessage({ type: 'error', text: formatMessage('admin.messages.error', { message: insertError.message }) });
      } else {
        setMessage({ type: 'success', text: t('admin.messages.success') });
        setNewTrusted({ email: '', first_name: '', last_name: '', phone: '', role: 'member', branch_id: '', notes: '' });
        await loadTrusted();
      }
    },
    [isDemo, loadTrusted, newTrusted, t, formatMessage, user]
  );

  const handleDeleteTrusted = useCallback(
    async (id: string) => {
      if (!confirm(t('admin.trusted.deleteConfirm'))) {
        return;
      }

      if (isDemo) {
        setMessage({ type: 'success', text: t('admin.trusted.deleteSuccess') });
        return;
      }

      const { error: deleteError } = await supabase.from('trusted_users').delete().eq('id', id);

      if (deleteError) {
        setMessage({ type: 'error', text: formatMessage('admin.trusted.deleteError', { message: deleteError.message }) });
      } else {
        setMessage({ type: 'success', text: t('admin.trusted.deleteSuccess') });
        await loadTrusted();
      }
    },
    [formatMessage, isDemo, loadTrusted, t]
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

  const handleAddOffer = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isDemo) {
        setMessage({ type: 'success', text: t('admin.messages.success') });
        return;
      }

      const allowNational = isCouncil;
      const effectiveScope: PartnerScope = allowNational ? newOffer.scope : 'local';
      const branchForLocal = effectiveScope === 'local' ? (allowNational ? newOffer.branchId : member?.branch?.id ?? null) : null;

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
    [formatMessage, isCouncil, isDemo, loadPartnerOffers, member?.branch?.id, newOffer, t, user]
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

  const pendingTitle = formatMessage('admin.members.pendingTitle', { count: pendingMembers.length });
  const approvedTitle = formatMessage('admin.members.listTitle', { count: members.length });
  const trustedTitle = formatMessage('admin.trusted.listTitle', { count: trustedUsers.length });
  const branchesTitle = formatMessage('admin.branches.listTitle', { count: branches.length });
  const partnersTitle = formatMessage('admin.partners.listTitle', { count: partnerOffers.length });

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
          {(['members', 'trusted', 'branches', 'partners'] as AdminTab[]).map((tab) => (
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

        {activeTab === 'members' && (
          <section className="space-y-6">
            <div className="psychocas-card space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" style={{ color: colors.brandPrimary }} />
                <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{pendingTitle}</h2>
              </div>
              {pendingMembers.length === 0 ? (
                <p style={{ color: colors.textSecondary }}>{t('admin.members.pendingEmpty')}</p>
              ) : (
                <div className="space-y-3">
                  {pendingMembers.map((item) => (
                    <div key={item.user_id} className="rounded-lg border p-4" style={{ borderColor: colors.border }}>
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div style={{ color: colors.textPrimary }}>
                          <div className="font-medium">{item.full_name ?? item.email}</div>
                          <div className="text-sm" style={{ color: colors.textSecondary }}>{item.email}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => void approveMember(item.user_id)}
                            className="psychocas-button-primary flex items-center gap-2"
                          >
                            <UserCheck className="h-4 w-4" />
                            {t('admin.members.approve')}
                          </button>
                          <button className="psychocas-button-secondary flex items-center gap-2" disabled>
                            <UserX className="h-4 w-4" />
                            {t('admin.members.reject')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
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
                            <MapPin className="mr-1 inline h-4 w-4" />
                            {new Intl.DateTimeFormat(locale).format(new Date(item.membership_expires))}
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

        {activeTab === 'trusted' && (
          <section className="space-y-6">
            <form className="psychocas-card space-y-3" onSubmit={handleAddTrusted}>
              <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{t('admin.trusted.formTitle')}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="psychocas-input"
                  placeholder={t('admin.trusted.form.email')}
                  value={newTrusted.email}
                  onChange={(event) => setNewTrusted((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
                <input
                  className="psychocas-input"
                  placeholder={t('admin.trusted.form.firstName')}
                  value={newTrusted.first_name}
                  onChange={(event) => setNewTrusted((prev) => ({ ...prev, first_name: event.target.value }))}
                  required
                />
                <input
                  className="psychocas-input"
                  placeholder={t('admin.trusted.form.lastName')}
                  value={newTrusted.last_name}
                  onChange={(event) => setNewTrusted((prev) => ({ ...prev, last_name: event.target.value }))}
                  required
                />
                <input
                  className="psychocas-input"
                  placeholder={t('admin.trusted.form.phone')}
                  value={newTrusted.phone}
                  onChange={(event) => setNewTrusted((prev) => ({ ...prev, phone: event.target.value }))}
                />
                <select
                  className="psychocas-input"
                  value={newTrusted.role}
                  onChange={(event) => setNewTrusted((prev) => ({ ...prev, role: event.target.value }))}
                >
                  <option value="member">{t('admin.trusted.form.roleOptions.member')}</option>
                  <option value="manager">{t('admin.trusted.form.roleOptions.manager')}</option>
                  <option value="council">{t('admin.trusted.form.roleOptions.council')}</option>
                  <option value="technician">{t('admin.trusted.form.roleOptions.technician')}</option>
                </select>
                <select
                  className="psychocas-input"
                  value={newTrusted.branch_id}
                  onChange={(event) => setNewTrusted((prev) => ({ ...prev, branch_id: event.target.value }))}
                >
                  <option value="">{t('admin.trusted.form.branchNone')}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                <input
                  className="psychocas-input md:col-span-2"
                  placeholder={t('admin.trusted.form.notes')}
                  value={newTrusted.notes}
                  onChange={(event) => setNewTrusted((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
              <button type="submit" className="psychocas-button-primary w-max flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                {t('admin.trusted.form.submit')}
              </button>
            </form>

            <div className="psychocas-card space-y-3">
              <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{trustedTitle}</h2>
              {trustedUsers.length === 0 ? (
                <p style={{ color: colors.textSecondary }}>{t('admin.trusted.listEmpty')}</p>
              ) : (
                <div className="space-y-3">
                  {trustedUsers.map((userRow) => (
                    <div key={userRow.id} className="rounded-lg border p-4" style={{ borderColor: colors.border }}>
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-medium" style={{ color: colors.textPrimary }}>
                            {`${userRow.first_name ?? ''} ${userRow.last_name ?? ''}`.trim() || userRow.email}
                          </div>
                          <div className="text-sm" style={{ color: colors.textSecondary }}>{userRow.email}</div>
                          {userRow.branch?.name && (
                            <div className="text-sm" style={{ color: colors.textSecondary }}>
                              <MapPin className="mr-1 inline h-4 w-4" />
                              {userRow.branch.name}
                            </div>
                          )}
                          {userRow.notes && (
                            <div className="text-sm" style={{ color: colors.textSecondary }}>{userRow.notes}</div>
                          )}
                        </div>
                        <button
                          onClick={() => void handleDeleteTrusted(userRow.id)}
                          className="psychocas-button-secondary flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t('admin.trusted.delete')}
                        </button>
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
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium" style={{ color: colors.textPrimary }}>{branch.name}</div>
                          <div className="text-sm" style={{ color: colors.textSecondary }}>
                            {branch.location ?? '—'} · {branch.discount_percentage}%
                          </div>
                        </div>
                        <button
                          onClick={() => void handleToggleBranch(branch)}
                          className="psychocas-button-secondary flex items-center gap-2"
                        >
                          <ToggleRight className="h-4 w-4" />
                          {t('admin.branches.toggleActive')}
                        </button>
                      </div>
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
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-medium" style={{ color: colors.textPrimary }}>{offer.title}</div>
                          <div className="text-sm" style={{ color: colors.textSecondary }}>{offer.description}</div>
                          <div className="text-sm" style={{ color: colors.textSecondary }}>
                            <Tag className="mr-1 inline h-4 w-4" />
                            {offer.discount_code || '—'} · {offer.discount_percentage}%
                          </div>
                        </div>
                        <div className="flex gap-2">
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
                  ))}
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
