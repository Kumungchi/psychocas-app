'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Users,
  CheckCircle,
  XCircle,
  Search,
  ShieldCheck,
  ShieldOff,
  RefreshCcw,
  UserCog,
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import useMemberContext from '@/hooks/useMemberContext';
import useLocale from '@/hooks/useLocale';
import type { MemberRole } from '@/types/member';
import { colors } from '@/ui/theme';

interface BranchRecord {
  id: string;
  name: string | null;
}

interface MembershipRow {
  id: string;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  role: string | null;
  membership_active: boolean;
  membership_expires: string | null;
  branch?: BranchRecord | BranchRecord[] | null;
}

interface ManagedPerson {
  id: string;
  tableId: string;
  email: string;
  fullName: string;
  role: MemberRole;
  membershipActive: boolean;
  membershipExpires: string | null;
  branchName?: string | null;
}

type StatusFilter = 'all' | 'active' | 'inactive';

const demoPeople: ManagedPerson[] = [
  {
    id: 'memberships:demo-1',
    tableId: 'demo-1',
    email: 'jana.novakova@example.com',
    fullName: 'Jana Nováková',
    role: 'manager',
    membershipActive: true,
    membershipExpires: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    branchName: 'Demo Branch',
  },
  {
    id: 'memberships:demo-2',
    tableId: 'demo-2',
    email: 'ondrej.technician@example.com',
    fullName: 'Ondřej Technik',
    role: 'technician',
    membershipActive: true,
    membershipExpires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    branchName: 'Demo Branch',
  },
  {
    id: 'memberships:demo-3',
    tableId: 'demo-3',
    email: 'eva.member@example.com',
    fullName: 'Eva Členová',
    role: 'member',
    membershipActive: false,
    membershipExpires: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    branchName: 'Demo Branch',
  },
];

const toBranchName = (branch: BranchRecord | BranchRecord[] | null | undefined) => {
  if (!branch) {
    return null;
  }

  const record = Array.isArray(branch) ? branch[0] ?? null : branch;
  return record?.name ?? null;
};

export default function Technician() {
  const { t, formatMessage, locale } = useLocale();
  const { status, member, error, refresh } = useMemberContext({ scope: 'technician-console' });
  const memberRole: MemberRole = member?.role ?? 'member';
  const canManage = memberRole === 'technician' || memberRole === 'council' || memberRole === 'admin';
  const isDemo = member?.origin === 'demo';

  const [people, setPeople] = useState<ManagedPerson[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const resolveRoleLabel = useCallback(
    (role: MemberRole) => t(`technician.roleLabels.${role}`),
    [t]
  );

  const refreshRecords = useCallback(async () => {
    if (isDemo) {
      setPeople(demoPeople);
      setLoadError(t('technician.states.demoNotice'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    const { data, error } = await supabase
      .from('memberships')
      .select(
        `id, user_id, email, full_name, role, membership_active, membership_expires,
         branch:branch_id (id, name)`
      )
      .order('full_name', { ascending: true });

    if (error) {
      setLoadError(t('technician.states.loadErrorMembers'));
      setPeople([]);
      setIsLoading(false);
      return;
    }

    const memberRows = (data ?? []) as MembershipRow[];

    const normalizedMembers: ManagedPerson[] = memberRows.map((row) => ({
      id: `memberships:${row.id}`,
      tableId: row.id,
      email: row.email ?? 'unknown@example.com',
      fullName: row.full_name?.trim() || row.email || 'Member',
      role: (row.role ?? 'member') as MemberRole,
      membershipActive: row.membership_active,
      membershipExpires: row.membership_expires,
      branchName: toBranchName(row.branch),
    }));

    setPeople(normalizedMembers);
    setLoadError(null);
    setIsLoading(false);
  }, [isDemo, supabase, t]);

  useEffect(() => {
    if (status === 'ready' && canManage) {
      void refreshRecords();
    }
  }, [canManage, refreshRecords, status]);

  const handleToggleMembership = useCallback(
    async (person: ManagedPerson) => {
      if (isDemo) {
        setLoadError(t('technician.states.demoNotice'));
        return;
      }

      const nextStatus = !person.membershipActive;
      setUpdatingId(person.id);
      setLoadError(null);

      const { error: updateError } = await supabase
        .from('memberships')
        .update({ membership_active: nextStatus })
        .eq('id', person.tableId);

      if (updateError) {
        setLoadError(t('technician.states.loadErrorGeneral'));
        setUpdatingId(null);
        return;
      }

      setPeople((previous) =>
        previous.map((entry) =>
          entry.id === person.id
            ? { ...entry, membershipActive: nextStatus }
            : entry
        )
      );
      setUpdatingId(null);
    },
    [isDemo, t]
  );

  const filteredPeople = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return people.filter((item) => {
      if (statusFilter === 'active' && !item.membershipActive) {
        return false;
      }
      if (statusFilter === 'inactive' && item.membershipActive) {
        return false;
      }
      if (!search) {
        return true;
      }

      return (
        item.email.toLowerCase().includes(search) ||
        item.fullName.toLowerCase().includes(search)
      );
    });
  }, [people, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const total = people.length;
    const active = people.filter((person) => person.membershipActive).length;
    const inactive = people.filter((person) => !person.membershipActive).length;

    return { total, active, inactive };
  }, [people]);

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card" style={{ color: colors.textSecondary }}>
            {t('technician.states.loadingMember')}
          </div>
        </div>
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card" style={{ color: colors.textSecondary }}>
            {t('technician.states.loginRequired')}
          </div>
        </div>
      </main>
    );
  }

  if (status === 'error' || !member) {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card space-y-3">
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {t('technician.states.memberErrorTitle')}
            </h2>
            <p style={{ color: colors.textSecondary }}>{error ?? t('technician.states.memberErrorDescription')}</p>
            <button onClick={refresh} className="psychocas-button-primary w-max flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" /> {t('technician.states.refresh')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card space-y-2">
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {t('technician.states.accessDeniedTitle')}
            </h2>
            <p style={{ color: colors.textSecondary }}>{t('technician.states.accessDeniedDescription')}</p>
          </div>
        </div>
        <Navigation userRole={memberRole} />
      </main>
    );
  }

  return (
    <main className="psychocas-section pb-20">
      <div className="psychocas-container space-y-6 fade-in-up">
        <header className="text-center pt-6 space-y-2">
          <h1>{t('technician.heading')}</h1>
          <p style={{ color: colors.textSecondary }}>{t('technician.description')}</p>
          <div className="flex justify-center gap-3 text-sm" style={{ color: colors.textSecondary }}>
            <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4" />{t('technician.legend.active')}</span>
            <span className="flex items-center gap-1"><ShieldOff className="h-4 w-4" />{t('technician.legend.inactive')}</span>
          </div>
          {isDemo && (
            <p className="text-sm" style={{ color: colors.warning }}>{t('technician.states.demoNotice')}</p>
          )}
        </header>

        {loadError && (
          <div
            className="psychocas-card text-sm"
            style={{
              border: `1px solid ${colors.danger}`,
              color: colors.danger,
              backgroundColor: colors.dangerSurface,
            }}
          >
            {loadError}
          </div>
        )}

        <section className="psychocas-card space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: colors.textSecondary }} />
              <input
                placeholder={t('technician.filters.searchPlaceholder')}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="psychocas-input pl-10"
              />
            </div>
            <button
              onClick={() => void refreshRecords()}
              className="psychocas-button-secondary flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {t('technician.filters.refresh')}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <button
              className="px-3 py-1 rounded-full border"
              style={{
                backgroundColor: statusFilter === 'active' ? colors.accent : colors.background,
                color: statusFilter === 'active' ? colors.background : colors.textSecondary,
                borderColor: statusFilter === 'active' ? colors.accent : colors.border,
              }}
              onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
            >
              {t('technician.filters.status.active')}
            </button>
            <button
              className="px-3 py-1 rounded-full border"
              style={{
                backgroundColor: statusFilter === 'inactive' ? colors.danger : colors.background,
                color: statusFilter === 'inactive' ? colors.background : colors.textSecondary,
                borderColor: statusFilter === 'inactive' ? colors.danger : colors.border,
              }}
              onClick={() => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive')}
            >
              {t('technician.filters.status.inactive')}
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="psychocas-card text-center space-y-1">
            <Users className="h-8 w-8 mx-auto" style={{ color: colors.brandPrimary }} />
            <div className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{summary.total}</div>
            <p className="text-sm" style={{ color: colors.textSecondary }}>{t('technician.statsCards.total')}</p>
          </div>
          <div className="psychocas-card text-center space-y-1">
            <CheckCircle className="h-8 w-8 mx-auto" style={{ color: colors.accent }} />
            <div className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{summary.active}</div>
            <p className="text-sm" style={{ color: colors.textSecondary }}>{t('technician.statsCards.active')}</p>
          </div>
          <div className="psychocas-card text-center space-y-1">
            <XCircle className="h-8 w-8 mx-auto" style={{ color: colors.danger }} />
            <div className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{summary.inactive}</div>
            <p className="text-sm" style={{ color: colors.textSecondary }}>{t('technician.statsCards.inactive')}</p>
          </div>
        </section>

        <section className="psychocas-card space-y-4">
          <div className="flex items-center justify-between gap-4 border-b pb-3" style={{ borderColor: colors.border }}>
            <div>
              <h3 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                {formatMessage('technician.table.heading', { count: filteredPeople.length })}
              </h3>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                {t('technician.table.description')}
              </p>
            </div>
            <UserCog className="h-6 w-6" style={{ color: colors.brandPrimary }} />
          </div>

          <div className="space-y-3">
            {filteredPeople.map((person) => {
            const statusBadge = person.membershipActive
              ? {
                  backgroundColor: colors.successSurface,
                  color: colors.success,
                  label: t('technician.statusBadge.active'),
                }
              : {
                  backgroundColor: colors.dangerSurface,
                  color: colors.dangerStrong,
                  label: t('technician.statusBadge.inactive'),
                };
            const statusBadgeStyle = {
              backgroundColor: statusBadge.backgroundColor,
              color: statusBadge.color,
            };

              const roleBadge = person.membershipActive
                ? { backgroundColor: colors.brandSurfaceAlt, color: colors.brandPrimary }
                : { backgroundColor: colors.neutralSurface, color: colors.textSecondary };

              const branchLabel = person.branchName
                ? formatMessage('technician.table.branch', { branch: person.branchName })
                : null;

            const membershipLabel = person.membershipExpires
              ? formatMessage('technician.table.membershipExpires', {
                  date: new Intl.DateTimeFormat(locale).format(new Date(person.membershipExpires)),
                })
              : t('technician.table.membershipNoExpiry');

              return (
                <div
                  key={person.id}
                  className="rounded-xl border p-4 transition-shadow hover:shadow-md"
                  style={{ borderColor: colors.border, backgroundColor: colors.background }}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium" style={{ color: colors.textPrimary }}>
                          {person.fullName}
                        </h4>
                        <span className="px-2 py-1 text-xs font-medium rounded-full" style={roleBadge}>
                          {resolveRoleLabel(person.role)}
                        </span>
                        <span className="px-2 py-1 text-xs font-medium rounded-full" style={statusBadgeStyle}>
                          {statusBadge.label}
                        </span>
                      </div>

                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        {formatMessage('technician.table.email', { email: person.email })}
                      </p>
                      {branchLabel && (
                        <p className="text-sm" style={{ color: colors.textSecondary }}>
                          {branchLabel}
                        </p>
                      )}
                      {membershipLabel && (
                        <p className="text-sm" style={{ color: colors.textSecondary }}>
                          {membershipLabel}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void handleToggleMembership(person)}
                        className="psychocas-button-secondary flex items-center gap-2"
                        disabled={updatingId === person.id || isDemo}
                      >
                        {person.membershipActive ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        {person.membershipActive
                          ? t('technician.table.toggleDeactivate')
                          : t('technician.table.toggleActivate')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredPeople.length === 0 && !isLoading && (
            <div className="text-center py-8" style={{ color: colors.textSecondary }}>
              {t('technician.table.empty')}
            </div>
          )}

          {isLoading && (
            <div className="text-center py-6" style={{ color: colors.textSecondary }}>
              {t('technician.table.loading')}
            </div>
          )}
        </section>

        <section className="psychocas-card" style={{ backgroundColor: colors.brandSurface }}>
          <h4 className="mb-2" style={{ color: colors.brandPrimary }}>
            {t('technician.info.title')}
          </h4>
          <ul className="space-y-1 text-sm" style={{ color: colors.brandPrimary }}>
            <li>{t('technician.info.item1')}</li>
            <li>{t('technician.info.item2')}</li>
            <li>{t('technician.info.item3')}</li>
          </ul>
        </section>
      </div>

      <Navigation userRole={memberRole} />
    </main>
  );
}
