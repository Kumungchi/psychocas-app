'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Users, CheckCircle, XCircle, Search, ShieldCheck, ShieldOff, RefreshCcw, UserPlus, UserCog } from 'lucide-react';
import Navigation from '@/components/Navigation';
import useMemberContext from '@/hooks/useMemberContext';
import type { MemberRole } from '@/types/member';

interface BranchRecord {
  id: string;
  name: string | null;
}

interface MemberRow {
  id: string;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  role: string | null;
  membership_active: boolean;
  membership_expires: string | null;
  branch?: BranchRecord | BranchRecord[] | null;
}

interface TrustedUserRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  membership_active: boolean | null;
  access_expires_at: string | null;
  branch?: BranchRecord | BranchRecord[] | null;
}

type RecordOrigin = 'members' | 'trusted_users';

interface ManagedPerson {
  id: string;
  tableId: string;
  email: string;
  fullName: string;
  role: MemberRole;
  membershipActive: boolean;
  membershipExpires: string | null;
  accessExpiresAt?: string | null;
  branchName?: string | null;
  origin: RecordOrigin;
}

type SourceFilter = 'all' | 'members' | 'trusted';
type StatusFilter = 'all' | 'active' | 'inactive';

const toBranchName = (branch: BranchRecord | BranchRecord[] | null | undefined) => {
  if (!branch) {
    return null;
  }

  const record = Array.isArray(branch) ? branch[0] ?? null : branch;
  return record?.name ?? null;
};

const roleLabel: Record<MemberRole, string> = {
  member: 'Člen',
  manager: 'Manažer',
  council: 'Rada',
  technician: 'Technik',
};

const roleBadgeStyle: Record<MemberRole, { bg: string; color: string }> = {
  member: { bg: '#e8f5e8', color: '#2e7d32' },
  manager: { bg: '#e1f5fe', color: '#049edb' },
  council: { bg: '#ffebee', color: '#c62828' },
  technician: { bg: '#fff3e0', color: '#ff9800' },
};

const originLabel: Record<RecordOrigin, string> = {
  members: 'Členové',
  trusted_users: 'Dočasný přístup',
};

export default function Technician() {
  const { status, member, error, refresh } = useMemberContext({ scope: 'technician-console' });
  const memberRole: MemberRole = member?.role ?? 'member';
  const canManage = memberRole === 'technician' || memberRole === 'council';

  const [people, setPeople] = useState<ManagedPerson[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const refreshRecords = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    const [membersResponse, trustedResponse] = await Promise.all([
      supabase
        .from('members')
        .select(
          `id, user_id, email, full_name, role, membership_active, membership_expires,
           branch:branch_id (id, name)`
        )
        .order('full_name', { ascending: true }),
      supabase
        .from('trusted_users')
        .select(
          `id, email, first_name, last_name, role, membership_active, access_expires_at,
           branch:branch_id (id, name)`
        )
        .order('first_name', { ascending: true })
    ]);

    let message: string | null = null;

    if (membersResponse.error && trustedResponse.error) {
      message = 'Nepodařilo se načíst žádná data. Zkuste to prosím znovu.';
    } else if (membersResponse.error) {
      message = 'Nepodařilo se načíst členy. Zobrazují se pouze dočasné přístupy.';
    } else if (trustedResponse.error) {
      message = 'Nepodařilo se načíst seznam dočasně povolených uživatelů. Zobrazují se pouze členové.';
    }

    const memberRows = membersResponse.error ? [] : ((membersResponse.data ?? []) as MemberRow[]);
    const trustedRows = trustedResponse.error ? [] : ((trustedResponse.data ?? []) as TrustedUserRow[]);

    const normalizedMembers: ManagedPerson[] = memberRows.map((row) => ({
      id: `members:${row.id}`,
      tableId: row.id,
      email: row.email ?? 'neznámý-email',
      fullName: row.full_name?.trim() || row.email || 'Neznámý člen',
      role: (row.role ?? 'member') as MemberRole,
      membershipActive: row.membership_active,
      membershipExpires: row.membership_expires,
      branchName: toBranchName(row.branch),
      origin: 'members',
    }));

    const normalizedTrusted: ManagedPerson[] = trustedRows.map((row) => {
      const nameParts = [row.first_name, row.last_name]
        .filter((part): part is string => Boolean(part && part.trim().length > 0))
        .map((part) => part.trim());

      return {
        id: `trusted:${row.id}`,
        tableId: row.id,
        email: row.email,
        fullName: nameParts.length > 0 ? nameParts.join(' ') : row.email,
        role: (row.role ?? 'member') as MemberRole,
        membershipActive: row.membership_active ?? true,
        membershipExpires: row.access_expires_at,
        accessExpiresAt: row.access_expires_at,
        branchName: toBranchName(row.branch),
        origin: 'trusted_users',
      };
    });

    setPeople([...normalizedMembers, ...normalizedTrusted]);
    setLoadError(message);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (status === 'ready' && canManage) {
      void refreshRecords();
    }
  }, [canManage, refreshRecords, status]);

  const handleToggleMembership = useCallback(
    async (person: ManagedPerson) => {
      const nextStatus = !person.membershipActive;
      setUpdatingId(person.id);
      setLoadError(null);

      if (person.origin === 'members') {
        const { error: updateError } = await supabase
          .from('members')
          .update({ membership_active: nextStatus })
          .eq('id', person.tableId);

        if (updateError) {
          setLoadError('Nepodařilo se aktualizovat stav člena.');
          setUpdatingId(null);
          return;
        }
      } else {
        const { error: updateError } = await supabase
          .from('trusted_users')
          .update({ membership_active: nextStatus })
          .eq('id', person.tableId);

        if (updateError) {
          setLoadError('Nepodařilo se aktualizovat stav dočasného přístupu.');
          setUpdatingId(null);
          return;
        }
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
    []
  );

  const filteredPeople = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return people.filter((item) => {
      if (sourceFilter === 'members' && item.origin !== 'members') {
        return false;
      }
      if (sourceFilter === 'trusted' && item.origin !== 'trusted_users') {
        return false;
      }
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
  }, [people, searchTerm, sourceFilter, statusFilter]);

  const summary = useMemo(() => {
    const total = people.length;
    const active = people.filter((person) => person.membershipActive && person.origin === 'members').length;
    const inactive = people.filter((person) => !person.membershipActive && person.origin === 'members').length;
    const trusted = people.filter((person) => person.origin === 'trusted_users').length;

    return { total, active, inactive, trusted };
  }, [people]);

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container space-y-6 fade-in-up">
          <div className="psychocas-card">
            <p style={{ color: '#666666' }}>Načítám oprávnění…</p>
          </div>
        </div>
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container space-y-6 fade-in-up">
          <div className="psychocas-card">
            <p style={{ color: '#666666' }}>Pro vstup do správy je nutné se přihlásit.</p>
          </div>
        </div>
      </main>
    );
  }

  if (status === 'error' || !member) {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container space-y-6 fade-in-up">
          <div className="psychocas-card space-y-3">
            <h2 className="text-lg font-semibold" style={{ color: '#333333' }}>Nepodařilo se načíst oprávnění</h2>
            <p style={{ color: '#666666' }}>{error ?? 'Zkuste prosím načíst stránku znovu.'}</p>
            <button
              onClick={refresh}
              className="psychocas-button-primary flex items-center gap-2 w-max"
            >
              <RefreshCcw className="w-4 h-4" /> Obnovit
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container space-y-6 fade-in-up">
          <div className="psychocas-card space-y-2">
            <h2 className="text-lg font-semibold" style={{ color: '#333333' }}>Přístup zamítnut</h2>
            <p style={{ color: '#666666' }}>
              Technický přehled je dostupný pouze pro techniky a členy rady. V případě potřeby kontaktujte správce.
            </p>
          </div>
        </div>
        <Navigation userRole={memberRole} />
      </main>
    );
  }

  return (
    <main className="psychocas-section pb-20">
      <div className="psychocas-container space-y-6 fade-in-up">
        {/* Header */}
        <div className="text-center pt-6 space-y-2">
          <h1 className="mb-1">Správa členů</h1>
          <p style={{ color: '#666666' }}>Kompletní přehled členů a dočasně povolených uživatelů</p>
          <div className="flex justify-center gap-3 text-sm" style={{ color: '#666666' }}>
            <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Aktivní přístup</span>
            <span className="flex items-center gap-1"><ShieldOff className="w-4 h-4" /> Pozastaveno</span>
          </div>
        </div>

        {loadError && (
          <div className="psychocas-card border border-red-200 bg-red-50 text-sm" style={{ color: '#c62828' }}>
            {loadError}
          </div>
        )}

        {/* Controls */}
        <div className="psychocas-card space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: '#666666' }} />
              <input
                placeholder="Hledat podle emailu nebo jména…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="psychocas-input pl-10"
              />
            </div>
            <button
              onClick={() => void refreshRecords()}
              className="psychocas-button-secondary flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Obnovit data
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <button
              className={`px-3 py-1 rounded-full border ${sourceFilter === 'all' ? 'bg-[#1d4f7d] text-white border-[#1d4f7d]' : 'border-[#cccccc]'}`}
              onClick={() => setSourceFilter('all')}
            >
              Všichni ({people.length})
            </button>
            <button
              className={`px-3 py-1 rounded-full border ${sourceFilter === 'members' ? 'bg-[#1d4f7d] text-white border-[#1d4f7d]' : 'border-[#cccccc]'}`}
              onClick={() => setSourceFilter('members')}
            >
              Členové ({summary.total - summary.trusted})
            </button>
            <button
              className={`px-3 py-1 rounded-full border ${sourceFilter === 'trusted' ? 'bg-[#1d4f7d] text-white border-[#1d4f7d]' : 'border-[#cccccc]'}`}
              onClick={() => setSourceFilter('trusted')}
            >
              Dočasně povolení ({summary.trusted})
            </button>
            <button
              className={`px-3 py-1 rounded-full border ${statusFilter === 'active' ? 'bg-[#2e7d32] text-white border-[#2e7d32]' : 'border-[#cccccc]'}`}
              onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
            >
              Aktivní
            </button>
            <button
              className={`px-3 py-1 rounded-full border ${statusFilter === 'inactive' ? 'bg-[#c62828] text-white border-[#c62828]' : 'border-[#cccccc]'}`}
              onClick={() => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive')}
            >
              Pozastavené
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="psychocas-card text-center">
            <Users className="w-8 h-8 mx-auto mb-2" style={{ color: '#1d4f7d' }} />
            <div className="text-2xl font-bold mb-1" style={{ color: '#333333' }}>
              {summary.total}
            </div>
            <p className="text-sm" style={{ color: '#666666' }}>Celkem záznamů</p>
          </div>

          <div className="psychocas-card text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: '#2e7d32' }} />
            <div className="text-2xl font-bold mb-1" style={{ color: '#333333' }}>
              {summary.active}
            </div>
            <p className="text-sm" style={{ color: '#666666' }}>Aktivních členů</p>
          </div>

          <div className="psychocas-card text-center">
            <XCircle className="w-8 h-8 mx-auto mb-2" style={{ color: '#c62828' }} />
            <div className="text-2xl font-bold mb-1" style={{ color: '#333333' }}>
              {summary.inactive}
            </div>
            <p className="text-sm" style={{ color: '#666666' }}>Pozastavených členů</p>
          </div>

          <div className="psychocas-card text-center">
            <UserPlus className="w-8 h-8 mx-auto mb-2" style={{ color: '#ff9800' }} />
            <div className="text-2xl font-bold mb-1" style={{ color: '#333333' }}>
              {summary.trusted}
            </div>
            <p className="text-sm" style={{ color: '#666666' }}>Dočasných přístupů</p>
          </div>
        </div>

        {/* Members List */}
        <div className="psychocas-card">
          <div className="flex items-center justify-between gap-4 border-b pb-3" style={{ borderColor: '#e0e0e0' }}>
            <div>
              <h3 className="text-lg font-semibold" style={{ color: '#333333' }}>
                Záznamy ({filteredPeople.length})
              </h3>
              <p className="text-sm" style={{ color: '#666666' }}>
                Spravujte členy i dočasné přístupy přímo z aplikace
              </p>
            </div>
            <UserCog className="w-6 h-6" style={{ color: '#1d4f7d' }} />
          </div>

          <div className="space-y-3 pt-3">
            {filteredPeople.map((person) => {
              const badgeStyle = roleBadgeStyle[person.role] ?? roleBadgeStyle.member;
              const statusBadge = person.membershipActive
                ? { bg: '#e8f5e8', color: '#2e7d32', label: 'Aktivní' }
                : { bg: '#ffebee', color: '#c62828', label: 'Pozastaveno' };

              return (
                <div
                  key={person.id}
                  className="p-4 rounded-xl border transition-shadow hover:shadow-md"
                  style={{ borderColor: '#e0e0e0', backgroundColor: '#fafafa' }}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium mr-2" style={{ color: '#333333' }}>
                          {person.fullName}
                        </h4>
                        <span className="px-2 py-1 rounded-full text-xs font-medium" style={badgeStyle}>
                          {roleLabel[person.role]}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium" style={statusBadge}>
                          {statusBadge.label}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#e3f2fd', color: '#1d4f7d' }}>
                          {originLabel[person.origin]}
                        </span>
                      </div>

                      <p className="text-sm" style={{ color: '#666666' }}>📧 {person.email}</p>
                      {person.branchName && (
                        <p className="text-sm" style={{ color: '#666666' }}>
                          🏢 Pobočka: {person.branchName}
                        </p>
                      )}
                      {person.membershipExpires && (
                        <p className="text-sm" style={{ color: '#666666' }}>
                          📅 Platnost do: {new Date(person.membershipExpires).toLocaleDateString('cs-CZ')}
                        </p>
                      )}
                      {person.accessExpiresAt && (
                        <p className="text-sm" style={{ color: '#666666' }}>
                          ⏳ Dočasný přístup končí: {new Date(person.accessExpiresAt).toLocaleDateString('cs-CZ')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void handleToggleMembership(person)}
                        className="psychocas-button-secondary flex items-center gap-2"
                        disabled={updatingId === person.id}
                      >
                        {person.membershipActive ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        {person.membershipActive ? 'Pozastavit' : 'Aktivovat'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredPeople.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <p style={{ color: '#666666' }}>Žádné záznamy neodpovídají zvoleným filtrům.</p>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-6">
              <p style={{ color: '#666666' }}>Načítám data…</p>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="psychocas-card" style={{ backgroundColor: '#e3f2fd' }}>
          <h4 className="mb-2" style={{ color: '#1d4f7d' }}>
            ℹ️ Doporučení pro techniky
          </h4>
          <ul className="space-y-1 text-sm" style={{ color: '#1d4f7d' }}>
            <li>• Spravujte stav členství přímo v této tabulce bez nutnosti přechodu do Supabase.</li>
            <li>• Dočasně povolené účty sledujte v samostatném filtru a nastavte jim datum vypršení.</li>
            <li>• Potřebujete-li upravit osobní údaje, využijte administrátorský přístup v Supabase.</li>
          </ul>
        </div>
      </div>

      {/* Navigation Bar */}
      <Navigation userRole={memberRole} />
    </main>
  );
}
