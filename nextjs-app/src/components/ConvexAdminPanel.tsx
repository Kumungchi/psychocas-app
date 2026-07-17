'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CalendarDays,
  Check,
  Filter,
  LogOut,
  Mail,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import useLocale from '@/hooks/useLocale';
import type { Locale } from '@/lib/i18n/config';
import { getDateLocale } from '@/lib/i18n/utils';
import { colors, radii, shadows, typography } from '@/ui/theme';
import MemberCsvImport from '@/components/MemberCsvImport';

type AccessStatus = 'active' | 'inactive' | 'expired' | 'revoked';
type MemberRole = 'member' | 'manager' | 'board' | 'admin';
type AdminTab = 'members' | 'branches' | 'assignments';
type StaffPreset =
  | 'support'
  | 'coordinator_hr'
  | 'coordinator_pr'
  | 'coordinator_partnerships'
  | 'coordinator_events'
  | 'manager'
  | 'board'
  | 'admin';
type Message = { type: 'success' | 'error' | 'info'; text: string } | null;

type FilterState = {
  search: string;
  status: AccessStatus | 'all';
  role: MemberRole | 'all';
  branchId: Id<'branches'> | 'all';
};

type GrantFormState = {
  id: Id<'accessGrants'> | '';
  email: string;
  fullName: string;
  role: MemberRole;
  status: AccessStatus;
  membershipUntil: string;
  branchId: Id<'branches'> | '';
  notes: string;
};

type BulkPatchState = {
  status: AccessStatus | 'no-change';
  role: MemberRole | 'no-change';
  branchId: Id<'branches'> | 'no-change' | 'none';
  membershipUntil: string;
  reason: string;
};

type AssignmentFormState = {
  accessGrantId: Id<'accessGrants'> | '';
  preset: StaffPreset;
  scope: 'organization' | 'branch';
  branchId: Id<'branches'> | '';
  validUntil: string;
  reason: string;
};

const presetLabels: Record<StaffPreset, string> = {
  support: 'Support',
  coordinator_hr: 'HR koordinátor',
  coordinator_pr: 'PR koordinátor',
  coordinator_partnerships: 'Koordinátor partnerství',
  coordinator_events: 'Event koordinátor',
  manager: 'Lokální manager',
  board: 'Board',
  admin: 'Admin',
};

const roleLabels: Record<MemberRole, string> = {
  member: 'Člen',
  manager: 'Manažer',
  board: 'Board',
  admin: 'Admin',
};

const statusLabels: Record<AccessStatus, string> = {
  active: 'Aktivní',
  inactive: 'Neaktivní',
  expired: 'Vypršelo',
  revoked: 'Zrušeno',
};

const defaultGrantForm = (): GrantFormState => ({
  id: '',
  email: '',
  fullName: '',
  role: 'member',
  status: 'active',
  membershipUntil: dateInputFromTimestamp(Date.now() + 365 * 24 * 60 * 60 * 1000),
  branchId: '',
  notes: '',
});

function dateInputFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timestampFromDateInput(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

function formatDate(timestamp: number, locale: Locale): string {
  return new Intl.DateTimeFormat(getDateLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function statusStyle(status: AccessStatus): React.CSSProperties {
  if (status === 'active') {
    return { background: colors.successSurface, color: colors.success };
  }
  if (status === 'expired') {
    return { background: colors.warningSurface, color: '#92400e' };
  }
  return { background: colors.dangerSurface, color: colors.dangerStrong };
}

function fieldStyle(): React.CSSProperties {
  return {
    width: '100%',
    minHeight: 44,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.md,
    background: colors.background,
    color: colors.textPrimary,
    padding: '0.72rem 0.85rem',
    outline: 'none',
  };
}

function softButtonStyle(): React.CSSProperties {
  return {
    minHeight: 42,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.md,
    background: colors.background,
    color: colors.textPrimary,
    padding: '0 0.9rem',
    fontWeight: 600,
  };
}

export default function ConvexAdminPanel() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { locale, tr } = useLocale();
  const viewer = useQuery(api.members.viewer);
  const canManage =
    viewer?.status === 'ready' &&
    viewer.member.membershipActive &&
    (viewer.member.role === 'board' || viewer.member.role === 'admin');

  const [activeTab, setActiveTab] = useState<AdminTab>('members');
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    role: 'all',
    branchId: 'all',
  });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [grantForm, setGrantForm] = useState<GrantFormState>(() => defaultGrantForm());
  const [bulkPatch, setBulkPatch] = useState<BulkPatchState>({
    status: 'no-change',
    role: 'no-change',
    branchId: 'no-change',
    membershipUntil: '',
    reason: '',
  });
  const [branchForm, setBranchForm] = useState({ name: '', city: '' });
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>({
    accessGrantId: '',
    preset: 'support',
    scope: 'branch',
    branchId: '',
    validUntil: '',
    reason: '',
  });
  const [message, setMessage] = useState<Message>(null);
  const [saving, setSaving] = useState(false);
  const [iamReady, setIamReady] = useState(false);
  const iamStartedRef = useRef(false);

  const grantArgs = useMemo(() => {
    const args: {
      status?: AccessStatus;
      role?: MemberRole;
      branchId?: Id<'branches'>;
      search?: string;
      limit: number;
    } = { limit: 200 };

    if (filters.status !== 'all') args.status = filters.status;
    if (filters.role !== 'all') args.role = filters.role;
    if (filters.branchId !== 'all') args.branchId = filters.branchId;
    if (filters.search.trim()) args.search = filters.search.trim();

    return args;
  }, [filters]);

  const accessGrants = useQuery(api.members.listAccessGrants, canManage ? grantArgs : 'skip');
  const branches = useQuery(api.branches.listForAdmin, canManage ? { includeInactive: true } : 'skip');
  const organizations = useQuery(api.iam.listOrganizations, canManage && iamReady ? {} : 'skip');
  const organizationId = organizations?.[0]?.id;
  const assignments = useQuery(
    api.iam.listAssignments,
    canManage && organizationId ? { organizationId, includeRevoked: true } : 'skip',
  );
  const upsertGrant = useMutation(api.members.upsertAccessGrant);
  const bulkUpdateGrants = useMutation(api.members.bulkUpdateAccessGrants);
  const createBranch = useMutation(api.branches.create);
  const setBranchActive = useMutation(api.branches.setActive);
  const ensureIam = useMutation(api.iam.ensureBootstrap);
  const upsertAssignment = useMutation(api.iam.upsertAssignment);
  const revokeAssignment = useMutation(api.iam.revokeAssignment);

  useEffect(() => {
    if (!canManage || iamStartedRef.current) return;
    iamStartedRef.current = true;
    void ensureIam()
      .then(() => setIamReady(true))
      .catch(() => {
        iamStartedRef.current = false;
        setMessage({ type: 'error', text: 'Oprávnění se nepodařilo připravit.' });
      });
  }, [canManage, ensureIam]);

  useEffect(() => {
    if (!assignmentForm.accessGrantId && accessGrants?.[0]) {
      setAssignmentForm((current) => ({ ...current, accessGrantId: accessGrants[0].id }));
    }
  }, [accessGrants, assignmentForm.accessGrantId]);

  const branchById = useMemo(() => {
    const map = new Map<string, { name: string; city: string; active: boolean }>();
    for (const branch of branches ?? []) {
      map.set(branch.id, { name: branch.name, city: branch.city, active: branch.active });
    }
    return map;
  }, [branches]);

  const activeBranches = useMemo(() => (branches ?? []).filter((branch) => branch.active), [branches]);
  const visibleAccessGrants = accessGrants ?? [];
  const selectedIds = useMemo(() => Array.from(selected) as Id<'accessGrants'>[], [selected]);
  const selectedCount = selectedIds.length;
  const allVisibleSelected =
    visibleAccessGrants.length > 0 && visibleAccessGrants.every((grant) => selected.has(grant.id));

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const toggleSelected = (id: Id<'accessGrants'>) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleVisibleSelection = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const grant of visibleAccessGrants) next.delete(grant.id);
      } else {
        for (const grant of visibleAccessGrants) next.add(grant.id);
      }
      return next;
    });
  };

  const fillGrantForm = (grant: NonNullable<typeof accessGrants>[number]) => {
    setGrantForm({
      id: grant.id,
      email: grant.email,
      fullName: grant.fullName,
      role: grant.role,
      status: grant.status,
      membershipUntil: dateInputFromTimestamp(grant.membershipUntil),
      branchId: grant.branchId ?? '',
      notes: grant.notes ?? '',
    });
    setMessage({ type: 'info', text: 'Člen je připravený k úpravě ve formuláři.' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveGrant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (!grantForm.email.trim() || !grantForm.fullName.trim() || !grantForm.membershipUntil) {
      setMessage({ type: 'error', text: 'Doplň email, jméno a platnost členství.' });
      return;
    }

    setSaving(true);
    try {
      const payload: {
        id?: Id<'accessGrants'>;
        email: string;
        fullName: string;
        role: MemberRole;
        membershipUntil: number;
        status: AccessStatus;
        branchId?: Id<'branches'>;
        notes?: string;
      } = {
        email: grantForm.email,
        fullName: grantForm.fullName,
        role: grantForm.role,
        membershipUntil: timestampFromDateInput(grantForm.membershipUntil),
        status: grantForm.status,
      };

      if (grantForm.id) payload.id = grantForm.id;
      if (grantForm.branchId) payload.branchId = grantForm.branchId;
      if (grantForm.notes.trim()) payload.notes = grantForm.notes;

      const result = await upsertGrant(payload);
      setMessage({
        type: 'success',
        text: result.status === 'created' ? 'Člen byl přidán.' : 'Člen byl aktualizován.',
      });
      setGrantForm(defaultGrantForm());
    } catch {
      setMessage({ type: 'error', text: 'Uložení se nepodařilo. Zkontroluj údaje a oprávnění.' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (selectedCount === 0) {
      setMessage({ type: 'error', text: 'Nejdřív vyber alespoň jednoho člena.' });
      return;
    }

    const patch: {
      status?: AccessStatus;
      role?: MemberRole;
      branchId?: Id<'branches'> | null;
      membershipUntil?: number;
    } = {};

    if (bulkPatch.status !== 'no-change') patch.status = bulkPatch.status;
    if (bulkPatch.role !== 'no-change') patch.role = bulkPatch.role;
    if (bulkPatch.branchId === 'none') patch.branchId = null;
    if (bulkPatch.branchId !== 'no-change' && bulkPatch.branchId !== 'none') patch.branchId = bulkPatch.branchId;
    if (bulkPatch.membershipUntil) patch.membershipUntil = timestampFromDateInput(bulkPatch.membershipUntil);

    if (Object.keys(patch).length === 0) {
      setMessage({ type: 'error', text: 'Vyber, co se má u označených členů změnit.' });
      return;
    }

    setSaving(true);
    try {
      const result = await bulkUpdateGrants({
        ids: selectedIds,
        patch,
        reason: bulkPatch.reason.trim() || undefined,
      });
      setMessage({ type: 'success', text: tr('Aktualizováno: {count} členů.').replace('{count}', String(result.updatedCount)) });
      setSelected(new Set());
      setBulkPatch({
        status: 'no-change',
        role: 'no-change',
        branchId: 'no-change',
        membershipUntil: '',
        reason: '',
      });
    } catch {
      setMessage({ type: 'error', text: 'Hromadná úprava se nepodařila.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBranch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (!branchForm.name.trim() || !branchForm.city.trim()) {
      setMessage({ type: 'error', text: 'Doplň název pobočky a město.' });
      return;
    }

    setSaving(true);
    try {
      await createBranch(branchForm);
      setBranchForm({ name: '', city: '' });
      setMessage({ type: 'success', text: 'Pobočka byla přidána.' });
    } catch {
      setMessage({ type: 'error', text: 'Pobočku se nepodařilo uložit.' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBranch = async (id: Id<'branches'>, active: boolean) => {
    setMessage(null);
    setSaving(true);
    try {
      await setBranchActive({ id, active: !active });
      setMessage({ type: 'success', text: active ? 'Pobočka byla vypnuta.' : 'Pobočka byla obnovena.' });
    } catch {
      setMessage({ type: 'error', text: 'Stav pobočky se nepodařilo změnit.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAssignment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organizationId || !assignmentForm.accessGrantId) return;
    const requiresBranch = assignmentForm.scope === 'branch';
    if (requiresBranch && !assignmentForm.branchId) {
      setMessage({ type: 'error', text: 'Pro lokální assignment vyber pobočku.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await upsertAssignment({
        accessGrantId: assignmentForm.accessGrantId,
        preset: assignmentForm.preset,
        scope: assignmentForm.scope,
        organizationId,
        branchId: requiresBranch ? (assignmentForm.branchId as Id<'branches'>) : undefined,
        validUntil: assignmentForm.validUntil
          ? timestampFromDateInput(assignmentForm.validUntil)
          : undefined,
        reason: assignmentForm.reason || undefined,
      });
      setMessage({ type: 'success', text: 'Oprávnění bylo uloženo.' });
      setAssignmentForm((current) => ({ ...current, reason: '', validUntil: '' }));
    } catch {
      setMessage({ type: 'error', text: 'Oprávnění se nepodařilo uložit. Zkontroluj preset a scope.' });
    } finally {
      setSaving(false);
    }
  };

  if (!viewer) {
    return (
      <main className="psychocas-section">
        <div className="psychocas-container">
          <div className="psychocas-card flex items-center gap-3 text-sm" style={{ color: colors.textSecondary }}>
            <RefreshCcw className="h-4 w-4 animate-spin" />
            {tr('Načítám administraci.')}
          </div>
        </div>
      </main>
    );
  }

  if (viewer.status !== 'ready' || !canManage) {
    return (
      <main className="psychocas-section">
        <div className="psychocas-container">
          <section className="psychocas-card space-y-3">
            <ShieldCheck className="h-8 w-8" style={{ color: colors.brandPrimary }} />
            <h1>{tr('Administrace')}</h1>
            <p style={{ color: colors.textSecondary }}>
              {tr('Tato část je dostupná pouze pro aktivní board a admin účet.')}
            </p>
            <button type="button" onClick={() => router.replace('/home')} style={softButtonStyle()}>
              {tr('Zpět do aplikace')}
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="psychocas-section pb-10">
      <div className="psychocas-container max-w-6xl space-y-5 fade-in-up">
        <header className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold" style={{ color: colors.brandPrimary }}>
              Psychočas
            </p>
            <h1 style={{ color: colors.textPrimary }}>{tr('Správa členství')}</h1>
            <p className="max-w-2xl text-sm leading-6" style={{ color: colors.textSecondary }}>
              {tr('Přidávání členů, filtrování a hromadné změny přístupů pro pilotní provoz.')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center gap-2"
            style={softButtonStyle()}
          >
            <LogOut className="h-4 w-4" />
            {tr('Odhlásit')}
          </button>
        </header>

        {message && (
          <div
            className="rounded-lg border px-4 py-3 text-sm"
            role={message.type === 'error' ? 'alert' : 'status'}
            style={{
              background:
                message.type === 'error'
                  ? colors.dangerSurface
                  : message.type === 'success'
                    ? colors.successSurface
                    : colors.infoSurface,
              borderColor:
                message.type === 'error'
                  ? colors.dangerSurface
                  : message.type === 'success'
                    ? colors.successSurface
                    : colors.infoSurface,
              color:
                message.type === 'error'
                  ? colors.dangerStrong
                  : message.type === 'success'
                    ? colors.success
                    : colors.brandOnSurface,
            }}
          >
            {tr(message.text)}
          </div>
        )}

        <nav className="grid grid-cols-3 gap-2 rounded-lg border bg-white p-1" style={{ borderColor: colors.border }}>
          {(['members', 'branches', 'assignments'] as AdminTab[]).map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold"
                style={{
                  background: active ? colors.brandPrimary : colors.background,
                  color: active ? colors.background : colors.textSecondary,
                }}
              >
                {tab === 'members' ? <Users className="h-4 w-4" /> : tab === 'branches' ? <Building2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                {tr(tab === 'members' ? 'Členové' : tab === 'branches' ? 'Pobočky' : 'Role')}
              </button>
            );
          })}
        </nav>

        {activeTab === 'members' && (
          <section className="grid gap-5 lg:grid-cols-[minmax(0,0.86fr)_minmax(22rem,0.44fr)]">
            <div className="space-y-5">
              {branches && <MemberCsvImport branches={branches} />}

              <section
                className="rounded-lg border bg-white p-4 sm:p-5"
                style={{ borderColor: colors.border, boxShadow: shadows.sm }}
              >
                <div className="mb-4 flex items-center gap-2">
                  <Filter className="h-4 w-4" style={{ color: colors.brandPrimary }} />
                  <h2 className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                    {tr('Filtry')}
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-1 text-sm">
                    <span style={{ color: colors.textSecondary }}>{tr('Hledat')}</span>
                    <div className="relative">
                      <Search
                        aria-hidden
                        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        style={{ color: colors.textSecondary }}
                      />
                      <input
                        value={filters.search}
                        onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                        placeholder={tr('Jméno nebo email')}
                        style={{ ...fieldStyle(), paddingLeft: '2.35rem' }}
                      />
                    </div>
                  </label>

                  <label className="space-y-1 text-sm">
                    <span style={{ color: colors.textSecondary }}>{tr('Stav')}</span>
                    <select
                      value={filters.status}
                      onChange={(event) =>
                        setFilters((prev) => ({ ...prev, status: event.target.value as AccessStatus | 'all' }))
                      }
                      style={fieldStyle()}
                    >
                      <option value="all">{tr('Všechny stavy')}</option>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {tr(label)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-sm">
                    <span style={{ color: colors.textSecondary }}>{tr('Role')}</span>
                    <select
                      value={filters.role}
                      onChange={(event) =>
                        setFilters((prev) => ({ ...prev, role: event.target.value as MemberRole | 'all' }))
                      }
                      style={fieldStyle()}
                    >
                      <option value="all">{tr('Všechny role')}</option>
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {tr(label)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-sm">
                    <span style={{ color: colors.textSecondary }}>{tr('Pobočka')}</span>
                    <select
                      value={filters.branchId}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          branchId: event.target.value as Id<'branches'> | 'all',
                        }))
                      }
                      style={fieldStyle()}
                    >
                      <option value="all">{tr('Všechny pobočky')}</option>
                      {activeBranches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <form
                onSubmit={handleBulkUpdate}
                className="rounded-lg border bg-white p-4 sm:p-5"
                style={{ borderColor: colors.border, boxShadow: shadows.sm }}
              >
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                      {tr('Hromadná úprava')}
                    </h2>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      {tr('Označeno:')} {selectedCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    disabled={selectedCount === 0}
                    className="inline-flex items-center justify-center gap-2"
                    style={softButtonStyle()}
                  >
                    <X className="h-4 w-4" />
                    {tr('Zrušit výběr')}
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <select
                    value={bulkPatch.status}
                    onChange={(event) =>
                      setBulkPatch((prev) => ({
                        ...prev,
                        status: event.target.value as AccessStatus | 'no-change',
                      }))
                    }
                    style={fieldStyle()}
                  >
                    <option value="no-change">{tr('Stav beze změny')}</option>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {tr('Nastavit:')} {tr(label)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={bulkPatch.role}
                    onChange={(event) =>
                      setBulkPatch((prev) => ({
                        ...prev,
                        role: event.target.value as MemberRole | 'no-change',
                      }))
                    }
                    style={fieldStyle()}
                  >
                    <option value="no-change">{tr('Role beze změny')}</option>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {tr('Nastavit:')} {tr(label)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={bulkPatch.branchId}
                    onChange={(event) =>
                      setBulkPatch((prev) => ({
                        ...prev,
                        branchId: event.target.value as Id<'branches'> | 'no-change' | 'none',
                      }))
                    }
                    style={fieldStyle()}
                  >
                    <option value="no-change">{tr('Pobočka beze změny')}</option>
                    <option value="none">{tr('Bez pobočky')}</option>
                    {activeBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={bulkPatch.membershipUntil}
                    onChange={(event) => setBulkPatch((prev) => ({ ...prev, membershipUntil: event.target.value }))}
                    aria-label={tr('Nová platnost členství')}
                    style={fieldStyle()}
                  />
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input
                    value={bulkPatch.reason}
                    onChange={(event) => setBulkPatch((prev) => ({ ...prev, reason: event.target.value }))}
                    placeholder={tr('Poznámka ke změně')}
                    style={fieldStyle()}
                  />
                  <button
                    type="submit"
                    disabled={saving || selectedCount === 0}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-semibold"
                    style={{
                      background: saving || selectedCount === 0 ? colors.neutralSurface : colors.brandPrimary,
                      color: saving || selectedCount === 0 ? colors.textSecondary : colors.background,
                    }}
                  >
                    <Check className="h-4 w-4" />
                    {tr('Uložit změny')}
                  </button>
                </div>
              </form>

              <section
                className="rounded-lg border bg-white"
                style={{ borderColor: colors.border, boxShadow: shadows.sm }}
              >
                <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: colors.border }}>
                  <div>
                    <h2 className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                      {tr('Přehled členů')}
                    </h2>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      {accessGrants ? tr('{count} záznamů').replace('{count}', String(accessGrants.length)) : tr('Načítám…')}
                    </p>
                  </div>
                  <button type="button" onClick={toggleVisibleSelection} style={softButtonStyle()}>
                    {tr(allVisibleSelected ? 'Odznačit vše' : 'Označit zobrazené')}
                  </button>
                </div>

                {!accessGrants ? (
                  <div className="p-4 text-sm" style={{ color: colors.textSecondary }}>
                    {tr('Načítám členy.')}
                  </div>
                ) : accessGrants.length === 0 ? (
                  <div className="p-4 text-sm" style={{ color: colors.textSecondary }}>
                    {tr('Žádní členové neodpovídají filtrům.')}
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: colors.border }}>
                    {accessGrants.map((grant) => {
                      const branch = grant.branchId ? branchById.get(grant.branchId) : null;
                      const isSelected = selected.has(grant.id);

                      return (
                        <article key={grant.id} className="p-4">
                          <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                            <label className="flex items-center gap-2 text-sm font-medium" style={{ color: colors.textPrimary }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelected(grant.id)}
                                className="h-5 w-5"
                                aria-label={`${tr('Označit')} ${grant.fullName}`}
                              />
                              <span className="sm:hidden">{tr('Označit')}</span>
                            </label>

                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-base font-semibold" style={{ color: colors.textPrimary }}>
                                  {grant.fullName}
                                </h3>
                                <span
                                  className="rounded-full px-2.5 py-1 text-xs font-semibold"
                                  style={statusStyle(grant.status)}
                                >
                                  {tr(statusLabels[grant.status])}
                                </span>
                                <span
                                  className="rounded-full px-2.5 py-1 text-xs font-semibold"
                                  style={{ background: colors.brandSurface, color: colors.brandPrimary }}
                                >
                                  {tr(roleLabels[grant.role])}
                                </span>
                              </div>
                              <div className="grid gap-1 text-sm" style={{ color: colors.textSecondary }}>
                                <span className="flex min-w-0 items-center gap-2">
                                  <Mail className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{grant.email}</span>
                                </span>
                                <span className="flex items-center gap-2">
                                  <CalendarDays className="h-4 w-4 shrink-0" />
                                  {tr('Platí do')} {formatDate(grant.membershipUntil, locale)}
                                </span>
                                <span className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 shrink-0" />
                                  {branch ? `${branch.name}, ${branch.city}` : tr('Bez pobočky')}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => fillGrantForm(grant)}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold"
                              style={softButtonStyle()}
                            >
                              <Save className="h-4 w-4" />
                              {tr('Upravit')}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <aside
              className="h-max rounded-lg border bg-white p-4 sm:p-5 lg:sticky lg:top-5"
              style={{ borderColor: colors.border, boxShadow: shadows.md }}
            >
              <div className="mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4" style={{ color: colors.brandPrimary }} />
                <h2 className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                  {tr('Přidat nebo upravit člena')}
                </h2>
              </div>
              <form onSubmit={handleSaveGrant} className="space-y-3">
                <label className="block space-y-1 text-sm">
                  <span style={{ color: colors.textSecondary }}>Email</span>
                  <input
                    type="email"
                    value={grantForm.email}
                    disabled={Boolean(grantForm.id)}
                    onChange={(event) => setGrantForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="jmeno@example.cz"
                    autoComplete="email"
                    style={{ ...fieldStyle(), background: grantForm.id ? colors.neutralSurface : colors.background }}
                  />
                  {grantForm.id && <span className="block text-xs" style={{ color: colors.textSecondary }}>{tr('Email nelze při úpravě změnit.')}</span>}
                </label>
                <label className="block space-y-1 text-sm">
                  <span style={{ color: colors.textSecondary }}>{tr('Jméno')}</span>
                  <input
                    value={grantForm.fullName}
                    onChange={(event) => setGrantForm((prev) => ({ ...prev, fullName: event.target.value }))}
                    placeholder={tr('Jméno člena')}
                    style={fieldStyle()}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1 text-sm">
                    <span style={{ color: colors.textSecondary }}>{tr('Role')}</span>
                    <select
                      value={grantForm.role}
                      onChange={(event) =>
                        setGrantForm((prev) => ({ ...prev, role: event.target.value as MemberRole }))
                      }
                      style={fieldStyle()}
                    >
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {tr(label)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span style={{ color: colors.textSecondary }}>{tr('Stav')}</span>
                    <select
                      value={grantForm.status}
                      onChange={(event) =>
                        setGrantForm((prev) => ({ ...prev, status: event.target.value as AccessStatus }))
                      }
                      style={fieldStyle()}
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {tr(label)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block space-y-1 text-sm">
                  <span style={{ color: colors.textSecondary }}>{tr('Platnost členství')}</span>
                  <input
                    type="date"
                    value={grantForm.membershipUntil}
                    onChange={(event) => setGrantForm((prev) => ({ ...prev, membershipUntil: event.target.value }))}
                    style={fieldStyle()}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span style={{ color: colors.textSecondary }}>{tr('Pobočka')}</span>
                  <select
                    value={grantForm.branchId}
                    onChange={(event) =>
                      setGrantForm((prev) => ({ ...prev, branchId: event.target.value as Id<'branches'> | '' }))
                    }
                    style={fieldStyle()}
                  >
                    <option value="">{tr('Bez pobočky')}</option>
                    {activeBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span style={{ color: colors.textSecondary }}>{tr('Poznámka')}</span>
                  <textarea
                    value={grantForm.notes}
                    onChange={(event) => setGrantForm((prev) => ({ ...prev, notes: event.target.value }))}
                    rows={3}
                    style={{ ...fieldStyle(), minHeight: 92, resize: 'vertical' }}
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setGrantForm(defaultGrantForm())}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-semibold"
                    style={softButtonStyle()}
                  >
                    {tr('Vyčistit')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-semibold"
                    style={{
                      background: saving ? colors.neutralSurface : colors.brandPrimary,
                      color: saving ? colors.textSecondary : colors.background,
                    }}
                  >
                    <Save className="h-4 w-4" />
                    {tr('Uložit')}
                  </button>
                </div>
              </form>
            </aside>
          </section>
        )}

        {activeTab === 'branches' && (
          <section className="grid gap-5 lg:grid-cols-[minmax(20rem,0.42fr)_1fr]">
            <form
              onSubmit={handleCreateBranch}
              className="h-max rounded-lg border bg-white p-4 sm:p-5"
              style={{ borderColor: colors.border, boxShadow: shadows.md }}
            >
              <div className="mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4" style={{ color: colors.brandPrimary }} />
                <h2 className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                  {tr('Nová pobočka')}
                </h2>
              </div>
              <div className="space-y-3">
                <input
                  value={branchForm.name}
                  onChange={(event) => setBranchForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder={tr('Název pobočky')}
                  style={fieldStyle()}
                />
                <input
                  value={branchForm.city}
                  onChange={(event) => setBranchForm((prev) => ({ ...prev, city: event.target.value }))}
                  placeholder={tr('Město')}
                  style={fieldStyle()}
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 font-semibold"
                  style={{
                    background: saving ? colors.neutralSurface : colors.brandPrimary,
                    color: saving ? colors.textSecondary : colors.background,
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {tr('Přidat pobočku')}
                </button>
              </div>
            </form>

            <section
              className="rounded-lg border bg-white"
              style={{ borderColor: colors.border, boxShadow: shadows.sm }}
            >
              <div className="border-b p-4" style={{ borderColor: colors.border }}>
                <h2 className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                  {tr('Pobočky')}
                </h2>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  {branches ? tr('{count} záznamů').replace('{count}', String(branches.length)) : tr('Načítám…')}
                </p>
              </div>
              {!branches ? (
                <p className="p-4 text-sm" style={{ color: colors.textSecondary }}>
                  {tr('Načítám pobočky.')}
                </p>
              ) : branches.length === 0 ? (
                <p className="p-4 text-sm" style={{ color: colors.textSecondary }}>
                  {tr('Zatím není přidaná žádná pobočka.')}
                </p>
              ) : (
                <div className="divide-y" style={{ borderColor: colors.border }}>
                  {branches.map((branch) => (
                    <article key={branch.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                          {branch.name}
                        </h3>
                        <p className="text-sm" style={{ color: colors.textSecondary }}>
                          {branch.city}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleToggleBranch(branch.id, branch.active)}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold"
                        style={{
                          ...softButtonStyle(),
                          color: branch.active ? colors.dangerStrong : colors.success,
                        }}
                      >
                        {tr(branch.active ? 'Vypnout' : 'Obnovit')}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        )}

        {activeTab === 'assignments' && (
          <section className="grid gap-5 lg:grid-cols-[minmax(22rem,0.45fr)_1fr]">
            <form
              onSubmit={handleSaveAssignment}
              className="h-max rounded-lg border bg-white p-4 sm:p-5 lg:sticky lg:top-5"
              style={{ borderColor: colors.border, boxShadow: shadows.md }}
            >
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" style={{ color: colors.brandPrimary }} />
                <div>
                  <h2 className="text-base font-semibold" style={{ color: colors.textPrimary }}>{tr('Přiřadit oprávnění')}</h2>
                  <p className="text-xs" style={{ color: colors.textSecondary }}>{tr('Preset a národní nebo lokální scope.')}</p>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block space-y-1 text-sm">
                  <span style={{ color: colors.textSecondary }}>{tr('Členský přístup')}</span>
                  <select value={assignmentForm.accessGrantId} onChange={(event) => setAssignmentForm((current) => ({ ...current, accessGrantId: event.target.value as Id<'accessGrants'> }))} style={fieldStyle()}>
                    <option value="" disabled>{tr('Vyber účet')}</option>
                    {accessGrants?.map((grant) => <option key={grant.id} value={grant.id}>{grant.fullName} · {grant.email}</option>)}
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span style={{ color: colors.textSecondary }}>{tr('Preset')}</span>
                  <select
                    value={assignmentForm.preset}
                    onChange={(event) => {
                      const preset = event.target.value as StaffPreset;
                      const organizationOnly = preset === 'board' || preset === 'admin';
                      const branchOnly = preset === 'manager';
                      setAssignmentForm((current) => ({
                        ...current,
                        preset,
                        scope: organizationOnly ? 'organization' : branchOnly ? 'branch' : current.scope,
                        branchId: organizationOnly ? '' : current.branchId,
                      }));
                    }}
                    style={fieldStyle()}
                  >
                    {Object.entries(presetLabels).map(([value, label]) => <option key={value} value={value}>{tr(label)}</option>)}
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span style={{ color: colors.textSecondary }}>{tr('Rozsah')}</span>
                  <select
                    value={assignmentForm.scope}
                    disabled={assignmentForm.preset === 'board' || assignmentForm.preset === 'admin' || assignmentForm.preset === 'manager'}
                    onChange={(event) => setAssignmentForm((current) => ({ ...current, scope: event.target.value as 'organization' | 'branch', branchId: event.target.value === 'organization' ? '' : current.branchId }))}
                    style={fieldStyle()}
                  >
                    <option value="organization">{tr('Celostátní')}</option>
                    <option value="branch">{tr('Jedna pobočka')}</option>
                  </select>
                </label>
                {assignmentForm.scope === 'branch' && (
                  <label className="block space-y-1 text-sm">
                    <span style={{ color: colors.textSecondary }}>{tr('Pobočka')}</span>
                    <select value={assignmentForm.branchId} onChange={(event) => setAssignmentForm((current) => ({ ...current, branchId: event.target.value as Id<'branches'> }))} style={fieldStyle()}>
                      <option value="" disabled>{tr('Vyber pobočku')}</option>
                      {activeBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                  </label>
                )}
                <label className="block space-y-1 text-sm"><span style={{ color: colors.textSecondary }}>{tr('Platnost do (volitelné)')}</span><input type="date" value={assignmentForm.validUntil} onChange={(event) => setAssignmentForm((current) => ({ ...current, validUntil: event.target.value }))} style={fieldStyle()} /></label>
                <label className="block space-y-1 text-sm"><span style={{ color: colors.textSecondary }}>{tr('Důvod')}</span><input value={assignmentForm.reason} onChange={(event) => setAssignmentForm((current) => ({ ...current, reason: event.target.value }))} placeholder={tr('Např. PR koordinace 2026')} style={fieldStyle()} /></label>
                <button type="submit" disabled={saving || !assignmentForm.accessGrantId || !organizationId} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 font-semibold" style={{ background: saving ? colors.neutralSurface : colors.brandPrimary, color: saving ? colors.textSecondary : colors.background }}><Save className="h-4 w-4" /> {tr('Uložit oprávnění')}</button>
              </div>
            </form>

            <section className="rounded-lg border bg-white" style={{ borderColor: colors.border, boxShadow: shadows.sm }}>
              <div className="border-b p-4" style={{ borderColor: colors.border }}><h2 className="text-base font-semibold">{tr('Přiřazené role')}</h2><p className="text-sm" style={{ color: colors.textSecondary }}>{assignments ? tr('{count} záznamů').replace('{count}', String(assignments.length)) : tr('Načítám…')}</p></div>
              <div className="divide-y" style={{ borderColor: colors.border }}>
                {assignments?.map((assignment) => (
                  <article key={assignment.id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold">{assignment.fullName ?? tr('Člen bez přihlášení')}</h3><span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: assignment.status === 'active' ? colors.successSurface : colors.neutralSurface, color: assignment.status === 'active' ? colors.success : colors.textSecondary }}>{tr(assignment.status === 'active' ? 'Aktivní' : 'Odebráno')}</span></div>
                        <p className="mt-1 truncate text-sm" style={{ color: colors.textSecondary }}>{assignment.email}</p>
                        <p className="mt-2 text-sm"><strong>{tr(presetLabels[assignment.preset])}</strong> · {assignment.scope === 'organization' ? tr('celostátní') : assignment.branch?.name ?? tr('lokální')}</p>
                        {assignment.validUntil && <p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>{tr('Platí do')} {formatDate(assignment.validUntil, locale)}</p>}
                      </div>
                      {assignment.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(tr('Odebrat oprávnění {preset}?').replace('{preset}', tr(presetLabels[assignment.preset])))) return;
                            void revokeAssignment({ id: assignment.id, reason: 'Odebráno v administraci Psychočasu.' })
                              .then(() => setMessage({ type: 'success', text: 'Oprávnění bylo odebráno.' }))
                              .catch(() => setMessage({ type: 'error', text: 'Oprávnění nelze odebrat. Poslední board/admin musí zůstat aktivní.' }));
                          }}
                          className="min-h-10 rounded-lg border px-3 text-sm font-semibold"
                          style={{ borderColor: colors.border, color: colors.dangerStrong }}
                        >
                          {tr('Odebrat')}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
                {assignments?.length === 0 && <p className="p-6 text-center text-sm" style={{ color: colors.textSecondary }}>{tr('Zatím není přiřazené žádné scoped oprávnění.')}</p>}
              </div>
            </section>
          </section>
        )}
      </div>

      <style jsx>{`
        main,
        input,
        select,
        textarea,
        button {
          font-family: ${typography.body};
        }
      `}</style>
    </main>
  );
}
