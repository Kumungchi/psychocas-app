import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PostgrestResponse, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import type {
  BranchInfo,
  MemberData,
  MemberRole,
  MemberRow,
  TrustedUserRow,
} from '@/types/member';
import { logDebug, logError, logInfo, logWarn } from '@/lib/logging';

const MEMBER_FETCH_MAX_ATTEMPTS = 3;
const MEMBER_FETCH_RETRY_DELAY_MS = 400;

type MemberContextStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unauthenticated';

export interface MemberResolutionResult {
  status: Extract<MemberContextStatus, 'ready' | 'error' | 'unauthenticated'>;
  user: User | null;
  member: MemberData | null;
  usedTrustedFallback: boolean;
  error?: string;
  lastSyncedAt?: string | null;
}

export interface UseMemberContextOptions {
  enabled?: boolean;
  autoResolve?: boolean;
  onUnauthorized?: () => void;
  scope?: string;
}

export interface UseMemberContextValue {
  status: MemberContextStatus;
  member: MemberData | null;
  user: User | null;
  error: string | null;
  refresh: () => Promise<MemberResolutionResult>;
  usedTrustedFallback: boolean;
  lastSyncedAt: string | null;
}

const DEFAULT_SCOPE = 'member-context';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const escapeIlikePattern = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

function normalizeBranch(branch: BranchInfo | BranchInfo[] | null | undefined): BranchInfo | null {
  if (!branch) {
    return null;
  }

  if (Array.isArray(branch)) {
    return branch[0] ?? null;
  }

  return branch;
}

function normalizeMemberRow(memberRow: MemberRow | null): MemberData | null {
  if (!memberRow) {
    return null;
  }

  const normalizedBranch = normalizeBranch(memberRow.branch);

  return {
    membership_active: memberRow.membership_active,
    membership_expires: memberRow.membership_expires,
    full_name: memberRow.full_name,
    role: (memberRow.role ?? 'member') as MemberRole,
    branch_id: memberRow.branch_id,
    email: memberRow.email,
    approved: memberRow.approved ?? undefined,
    approved_at: memberRow.approved_at ?? null,
    phone: memberRow.phone ?? undefined,
    branch: normalizedBranch,
    origin: 'members',
  };
}

function normalizeTrustedUser(
  trustedRow: TrustedUserRow | null,
  userEmail: string | null
): MemberData | null {
  if (!trustedRow) {
    return null;
  }

  const normalizedBranch = normalizeBranch(trustedRow.branch);
  const nameParts = [trustedRow.first_name, trustedRow.last_name]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());

  const expiresAt = trustedRow.access_expires_at ?? null;
  const isActive = trustedRow.membership_active ?? (expiresAt ? new Date(expiresAt) > new Date() : true);

  return {
    membership_active: isActive,
    membership_expires: expiresAt,
    full_name: nameParts.length > 0 ? nameParts.join(' ') : null,
    role: (trustedRow.role ?? 'member') as MemberRole,
    branch_id: trustedRow.branch_id ?? null,
    email: userEmail,
    approved: true,
    approved_at: trustedRow.approved_at ?? null,
    phone: undefined,
    branch: normalizedBranch,
    origin: 'trusted_users',
    trusted_access_expires_at: expiresAt,
  };
}

async function fetchTrustedUserFallback(
  scope: string,
  emailRaw: string | null
): Promise<MemberData | null> {
  if (!emailRaw) {
    return null;
  }

  const normalizedEmail = emailRaw.trim().toLowerCase();
  const emailPatterns = Array.from(
    new Set(
      [emailRaw, normalizedEmail]
        .filter((value): value is string => Boolean(value && value.length > 0))
        .map((value) => escapeIlikePattern(value.toLowerCase()))
    )
  );

  if (emailPatterns.length === 0) {
    return null;
  }

  let trustedQuery = supabase
    .from<TrustedUserRow>('trusted_users')
    .select(
      `first_name, last_name, role, branch_id, approved_at, access_expires_at, membership_active,
       branch:branch_id (id, name, location, city, discount_percentage, active)`
    )
    .limit(1);

  if (emailPatterns.length === 1) {
    trustedQuery = trustedQuery.filter('email', 'ilike', emailPatterns[0]!);
  } else {
    trustedQuery = trustedQuery.or(emailPatterns.map((pattern) => `email.ilike.${pattern}`).join(','));
  }

  const { data, error } = await trustedQuery;

  if (error) {
    logError(scope, 'Trusted user fallback failed', error);
    return null;
  }

  const trustedRecord = data?.[0] ?? null;
  return normalizeTrustedUser(trustedRecord ?? null, emailRaw);
}

function buildMemberSelect(includeFullBranch: boolean): string {
  if (includeFullBranch) {
    return `
      membership_active,
      membership_expires,
      full_name,
      role,
      branch_id,
      email,
      approved,
      approved_at,
      phone,
      branch:branch_id (
        id,
        name,
        location,
        city,
        discount_percentage,
        active
      )
    `;
  }

  return `
    membership_active,
    membership_expires,
    full_name,
    role,
    branch_id,
    email,
    approved,
    approved_at,
    phone,
    branch:branch_id (
      id,
      name
    )
  `;
}

async function fetchMemberWithFallback(scope: string, userId: string): Promise<PostgrestResponse<MemberRow>> {
  let response = await supabase
    .from<MemberRow>('members')
    .select(buildMemberSelect(true))
    .eq('user_id', userId)
    .limit(1);

  if (!response.error) {
    return response;
  }

  if (response.error.code === '42703') {
    logWarn(scope, 'Member query missing optional columns, retrying with reduced branch view.', response.error);
    response = await supabase
      .from<MemberRow>('members')
      .select(buildMemberSelect(false))
      .eq('user_id', userId)
      .limit(1);
    if (!response.error) {
      return response;
    }
  }

  logWarn(scope, 'Member query failed with branch join, retrying without branch.', response.error);
  response = await supabase
    .from<MemberRow>('members')
    .select(
      `membership_active,
       membership_expires,
       full_name,
       role,
       branch_id,
       email,
       approved,
       approved_at,
       phone`
    )
    .eq('user_id', userId)
    .limit(1);

  return response;
}

export default function useMemberContext(options?: UseMemberContextOptions): UseMemberContextValue {
  const { enabled = true, autoResolve = true, onUnauthorized, scope = DEFAULT_SCOPE } = options ?? {};

  const [status, setStatus] = useState<MemberContextStatus>('idle');
  const [member, setMember] = useState<MemberData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedTrustedFallback, setUsedTrustedFallback] = useState(false);
  const lastSyncedAtRef = useRef<string | null>(null);

  const unauthorizedRef = useRef(onUnauthorized);
  useEffect(() => {
    unauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const resolveMember = useCallback(async (): Promise<MemberResolutionResult> => {
    if (!enabled) {
      return {
        status: 'error',
        user: null,
        member: null,
        usedTrustedFallback: false,
        error: 'Načítání členství je aktuálně vypnuto.',
        lastSyncedAt: lastSyncedAtRef.current,
      };
    }

    setStatus('loading');
    setError(null);
    setUsedTrustedFallback(false);

    const {
      data: { user: currentUser } = { user: null },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      logError(scope, 'supabase.auth.getUser failed', authError);
      const authFailure: MemberResolutionResult = {
        status: 'error',
        user: null,
        member: null,
        usedTrustedFallback: false,
        error: 'Nepodařilo se ověřit relaci. Zkuste to prosím znovu.',
        lastSyncedAt: lastSyncedAtRef.current,
      };
      setStatus('error');
      setError(authFailure.error ?? null);
      setUser(null);
      setMember(null);
      return authFailure;
    }

    if (!currentUser) {
      logInfo(scope, 'No authenticated user found.');
      const unauthenticated: MemberResolutionResult = {
        status: 'unauthenticated',
        user: null,
        member: null,
        usedTrustedFallback: false,
        lastSyncedAt: null,
      };
      setStatus('unauthenticated');
      setUser(null);
      setMember(null);
      setError(null);
      unauthorizedRef.current?.();
      return unauthenticated;
    }

    setUser(currentUser);
    const trustedEmailRaw = currentUser.email ?? null;
    logDebug(scope, 'Resolving member context.', { userId: currentUser.id, email: trustedEmailRaw });

    let memberResponse = await fetchMemberWithFallback(scope, currentUser.id);
    let attempt = 1;

    while (
      !memberResponse.error &&
      (!memberResponse.data || memberResponse.data.length === 0) &&
      attempt < MEMBER_FETCH_MAX_ATTEMPTS
    ) {
      attempt += 1;
      logWarn(scope, `Member record empty. Retrying (${attempt}/${MEMBER_FETCH_MAX_ATTEMPTS}).`);
      await delay(MEMBER_FETCH_RETRY_DELAY_MS);
      memberResponse = await fetchMemberWithFallback(scope, currentUser.id);
    }

    if (memberResponse.error) {
      logError(scope, 'Member fetch failed', memberResponse.error);
      const failure: MemberResolutionResult = {
        status: 'error',
        user: currentUser,
        member: null,
        usedTrustedFallback: false,
        error: 'Nepodařilo se načíst informace o členství.',
        lastSyncedAt: lastSyncedAtRef.current,
      };
      setStatus('error');
      setMember(null);
      setError(failure.error ?? null);
      return failure;
    }

    const memberRows = (memberResponse.data ?? []) as MemberRow[];
    const memberRow = memberRows[0] ?? null;
    const normalizedMember = normalizeMemberRow(memberRow);

    if (normalizedMember) {
      logDebug(scope, 'Member resolved from primary table.');
      setMember(normalizedMember);
      setStatus('ready');
      setUsedTrustedFallback(false);
      lastSyncedAtRef.current = new Date().toISOString();
      return {
        status: 'ready',
        user: currentUser,
        member: normalizedMember,
        usedTrustedFallback: false,
        lastSyncedAt: lastSyncedAtRef.current,
      };
    }

    const trustedFallback = await fetchTrustedUserFallback(scope, trustedEmailRaw);

    if (trustedFallback) {
      logInfo(scope, 'Using trusted_users fallback for member context.');
      setMember(trustedFallback);
      setStatus('ready');
      setUsedTrustedFallback(true);
      lastSyncedAtRef.current = new Date().toISOString();
      return {
        status: 'ready',
        user: currentUser,
        member: trustedFallback,
        usedTrustedFallback: true,
        lastSyncedAt: lastSyncedAtRef.current,
      };
    }

    logWarn(scope, 'Member context not found for user.');
    const emptyState: MemberResolutionResult = {
      status: 'error',
      user: currentUser,
      member: null,
      usedTrustedFallback: false,
      error: 'Členství nebylo nalezeno.',
      lastSyncedAt: lastSyncedAtRef.current,
    };
    setMember(null);
    setStatus('error');
    setError(emptyState.error ?? null);
    return emptyState;
  }, [enabled, scope]);

  const refresh = useCallback(async () => {
    const result = await resolveMember();
    return result;
  }, [resolveMember]);

  useEffect(() => {
    if (!enabled || !autoResolve) {
      return;
    }

    if (status === 'idle') {
      void refresh();
    }
  }, [autoResolve, enabled, refresh, status]);

  const memoizedValue = useMemo<UseMemberContextValue>(
    () => ({
      status,
      member,
      user,
      error,
      refresh,
      usedTrustedFallback,
      lastSyncedAt: lastSyncedAtRef.current,
    }),
    [error, member, refresh, status, usedTrustedFallback, user]
  );

  return memoizedValue;
}
