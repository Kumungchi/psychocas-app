import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PostgrestResponse, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import {
  isRolePreviewEnabled,
  readRolePreview,
  subscribeToRolePreview,
  type RolePreviewState,
} from '@/lib/demo/rolePreview';
import type {
  BranchInfo,
  MemberData,
  MemberRole,
  MembershipRow,
} from '@/types/member';
import { logDebug, logError, logInfo, logWarn } from '@/lib/logging';

const MEMBER_FETCH_MAX_ATTEMPTS = 3;
const MEMBER_FETCH_RETRY_DELAY_MS = 400;

type MemberContextStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unauthenticated';

export interface MemberResolutionResult {
  status: Extract<MemberContextStatus, 'ready' | 'error' | 'unauthenticated'>;
  user: User | null;
  member: MemberData | null;
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
  lastSyncedAt: string | null;
}

const DEFAULT_SCOPE = 'member-context';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function normalizeBranch(branch: BranchInfo | BranchInfo[] | null | undefined): BranchInfo | null {
  if (!branch) {
    return null;
  }

  if (Array.isArray(branch)) {
    return branch[0] ?? null;
  }

  return branch;
}

function normalizeMemberRow(memberRow: MembershipRow | null): MemberData | null {
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
    origin: 'memberships',
  };
}

function buildPreviewMember(state: RolePreviewState): MemberData {
  const fallbackRole: MemberRole = (state.role ?? 'member') as MemberRole;
  const requiresBranch = fallbackRole === 'manager';
  const branchId = state.branchId ?? (requiresBranch ? 'demo-branch' : null);
  const branchName = state.branchName ?? (requiresBranch ? 'Demo Branch' : null);

  return {
    membership_active: true,
    membership_expires: null,
    full_name: state.fullName ?? 'Demo User',
    role: fallbackRole,
    branch_id: branchId,
    email: state.email ?? 'demo@psychocas.cz',
    approved: true,
    approved_at: null,
    phone: null,
    branch: branchName ? { id: branchId ?? 'demo-branch', name: branchName } : null,
    origin: 'demo',
  };
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

async function fetchMemberWithFallback(scope: string, userId: string): Promise<PostgrestResponse<MembershipRow>> {
  let response = (await supabase
    .from('memberships')
    .select(buildMemberSelect(true))
    .eq('user_id', userId)
    .limit(1)) as PostgrestResponse<MembershipRow>;

  if (!response.error) {
    return response;
  }

  if (response.error.code === '42703') {
    logWarn(scope, 'Member query missing optional columns, retrying with reduced branch view.', response.error);
    response = (await supabase
      .from('memberships')
      .select(buildMemberSelect(false))
      .eq('user_id', userId)
      .limit(1)) as PostgrestResponse<MembershipRow>;
    if (!response.error) {
      return response;
    }
  }

  logWarn(scope, 'Member query failed with branch join, retrying without branch.', response.error);
  response = (await supabase
    .from('memberships')
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
    .limit(1)) as PostgrestResponse<MembershipRow>;

  return response;
}

export default function useMemberContext(options?: UseMemberContextOptions): UseMemberContextValue {
  const { enabled = true, autoResolve = true, onUnauthorized, scope = DEFAULT_SCOPE } = options ?? {};

  const [status, setStatus] = useState<MemberContextStatus>('idle');
  const [member, setMember] = useState<MemberData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSyncedAtRef = useRef<string | null>(null);
  const ensuredMembershipForUserRef = useRef<string | null>(null);
  const previewFeatureEnabled = isRolePreviewEnabled();
  const [previewState, setPreviewState] = useState<RolePreviewState>(() =>
    previewFeatureEnabled
      ? readRolePreview()
      : { role: null, branchId: null, branchName: null, fullName: null, email: null }
  );

  const unauthorizedRef = useRef(onUnauthorized);
  useEffect(() => {
    unauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  useEffect(() => {
    if (!previewFeatureEnabled) {
      return;
    }

    setPreviewState(readRolePreview());
    const unsubscribe = subscribeToRolePreview((state) => {
      setPreviewState(state);
      setStatus('idle');
    });

    return unsubscribe;
  }, [previewFeatureEnabled]);

  const resolveMember = useCallback(async (): Promise<MemberResolutionResult> => {
    if (!enabled) {
      return {
        status: 'error',
        user: null,
        member: null,
        error: 'Načítání členství je aktuálně vypnuto.',
        lastSyncedAt: lastSyncedAtRef.current,
      };
    }

    setStatus('loading');
    setError(null);

    const previewActive = previewFeatureEnabled && Boolean(previewState.role);
    const {
      data: { session } = { session: null },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      if (previewActive) {
        const previewMember = buildPreviewMember(previewState);
        lastSyncedAtRef.current = new Date().toISOString();
        setStatus('ready');
        setError(null);
        setMember(previewMember);
        setUser(null);
        return {
          status: 'ready',
          user: null,
          member: previewMember,
          lastSyncedAt: lastSyncedAtRef.current,
        };
      }

      logError(scope, 'supabase.auth.getSession failed', sessionError);
      const authFailure: MemberResolutionResult = {
        status: 'error',
        user: null,
        member: null,
        error: 'Nepodařilo se ověřit relaci. Zkuste to prosím znovu.',
        lastSyncedAt: lastSyncedAtRef.current,
      };
      setStatus('error');
      setError(authFailure.error ?? null);
      setUser(null);
      setMember(null);
      return authFailure;
    }

    const currentUser = session?.user ?? null;

    if (!currentUser) {
      if (previewActive) {
        const previewMember = buildPreviewMember(previewState);
        lastSyncedAtRef.current = new Date().toISOString();
        const previewResult: MemberResolutionResult = {
          status: 'ready',
          user: null,
          member: previewMember,
          lastSyncedAt: lastSyncedAtRef.current,
        };
        setStatus('ready');
        setUser(null);
        setMember(previewMember);
        setError(null);
        return previewResult;
      }

      logInfo(scope, 'No authenticated user found.');
      const unauthenticated: MemberResolutionResult = {
        status: 'unauthenticated',
        user: null,
        member: null,
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
    logDebug(scope, 'Resolving membership.', { userId: currentUser.id, email: currentUser.email });

    if (ensuredMembershipForUserRef.current !== currentUser.id) {
      const { error: ensureError } = await supabase.rpc('ensure_membership_from_whitelist');
      if (ensureError) {
        logWarn(scope, 'ensure_membership_from_whitelist RPC failed', ensureError);
      } else {
        ensuredMembershipForUserRef.current = currentUser.id;
      }
    }

    let memberResponse = await fetchMemberWithFallback(scope, currentUser.id);
    let attempt = 1;

    while (
      !memberResponse.error &&
      (!memberResponse.data || memberResponse.data.length === 0) &&
      attempt < MEMBER_FETCH_MAX_ATTEMPTS
    ) {
      attempt += 1;
      logWarn(scope, `Membership record empty. Retrying (${attempt}/${MEMBER_FETCH_MAX_ATTEMPTS}).`);
      await delay(MEMBER_FETCH_RETRY_DELAY_MS);
      memberResponse = await fetchMemberWithFallback(scope, currentUser.id);
    }

    if (memberResponse.error) {
      if (previewActive) {
        const previewMember = buildPreviewMember(previewState);
        lastSyncedAtRef.current = new Date().toISOString();
        setStatus('ready');
        setMember(previewMember);
        setUser(currentUser);
        setError(null);
        return {
          status: 'ready',
          user: currentUser,
          member: previewMember,
          lastSyncedAt: lastSyncedAtRef.current,
        };
      }

      logError(scope, 'Membership fetch failed', memberResponse.error);
      const failure: MemberResolutionResult = {
        status: 'error',
        user: currentUser,
        member: null,
        error: 'Nepodařilo se načíst informace o členství.',
        lastSyncedAt: lastSyncedAtRef.current,
      };
      setStatus('error');
      setMember(null);
      setError(failure.error ?? null);
      return failure;
    }

    const memberRows = (memberResponse.data ?? []) as MembershipRow[];
    const memberRow = memberRows[0] ?? null;
    const normalizedMember = normalizeMemberRow(memberRow);

    if (normalizedMember) {
      const expiresAt = normalizedMember.membership_expires
        ? new Date(normalizedMember.membership_expires)
        : null;
      const isActive =
        normalizedMember.membership_active &&
        (!expiresAt || expiresAt.getTime() > Date.now());

      if (!isActive) {
        logWarn(scope, 'Membership record found but not active.', {
          membership_active: normalizedMember.membership_active,
          membership_expires: normalizedMember.membership_expires,
        });
        lastSyncedAtRef.current = new Date().toISOString();
        const inactiveResult: MemberResolutionResult = {
          status: 'error',
          user: currentUser,
          member: null,
          error: 'Členství není aktivní.',
          lastSyncedAt: lastSyncedAtRef.current,
        };
        setMember(null);
        setStatus('error');
        setError(inactiveResult.error ?? null);
        return inactiveResult;
      }

      logDebug(scope, 'Membership resolved.');
      setMember(normalizedMember);
      setStatus('ready');
      lastSyncedAtRef.current = new Date().toISOString();
      return {
        status: 'ready',
        user: currentUser,
        member: normalizedMember,
        lastSyncedAt: lastSyncedAtRef.current,
      };
    }

    if (previewActive) {
      const previewMember = buildPreviewMember(previewState);
      lastSyncedAtRef.current = new Date().toISOString();
      setMember(previewMember);
      setStatus('ready');
      setError(null);
      return {
        status: 'ready',
        user: currentUser,
        member: previewMember,
        lastSyncedAt: lastSyncedAtRef.current,
      };
    }

    logWarn(scope, 'Membership not found for user.');
    const emptyState: MemberResolutionResult = {
      status: 'error',
      user: currentUser,
      member: null,
      error: 'Členství nebylo nalezeno.',
      lastSyncedAt: lastSyncedAtRef.current,
    };
    setMember(null);
    setStatus('error');
    setError(emptyState.error ?? null);
    return emptyState;
  }, [enabled, previewFeatureEnabled, previewState, scope]);


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

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        ensuredMembershipForUserRef.current = null;
        lastSyncedAtRef.current = null;
        setUser(null);
        setMember(null);
        setStatus('unauthenticated');
        setError(null);
        return;
      }

      setUser(session.user ?? null);

      if (!enabled) {
        return;
      }

      if (autoResolve && ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED'].includes(event)) {
        ensuredMembershipForUserRef.current = null;
        void refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [autoResolve, enabled, refresh]);

  const memoizedValue = useMemo<UseMemberContextValue>(
    () => ({
      status,
      member,
      user,
      error,
      refresh,
      lastSyncedAt: lastSyncedAtRef.current,
    }),
    [error, member, refresh, status, user]
  );

  return memoizedValue;
}
