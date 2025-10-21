import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PostgrestError, User } from '@supabase/supabase-js';
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
  MembershipProfileRow,
  MembershipRow,
  MembershipStatus,
} from '@/types/member';
import { logDebug, logError, logInfo, logWarn } from '@/lib/logging';

const MEMBER_FETCH_MAX_ATTEMPTS = 3;
const MEMBER_FETCH_RETRY_DELAY_MS = 400;

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

function normalizeMembership(
  membership: MembershipRow | null,
  profile: MembershipProfileRow | null,
  branch: BranchInfo | null
): MemberData | null {
  if (!membership) {
    return null;
  }

  const role = (membership.role ?? 'member') as MemberRole;
  const status = (membership.status ?? 'pending') as MembershipStatus;

  return {
    membership_active: Boolean(membership.membership_active),
    membership_expires: membership.membership_expires ?? null,
    status,
    full_name: profile?.full_name ?? null,
    role,
    branch_id: membership.branch_id ?? null,
    email: profile?.email ?? null,
    approved: status === 'active',
    approved_at: membership.approved_at ?? null,
    phone: profile?.phone ?? null,
    branch,
    origin: 'memberships',
  };
}

async function fetchProfile(userId: string, scope: string): Promise<MembershipProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, email, phone')
    .eq('id', userId)
    .maybeSingle<MembershipProfileRow>();

  if (error) {
    logWarn(scope, 'Failed to load profile for membership context.', error);
    return null;
  }

  return data ?? null;
}

async function fetchBranch(branchId: string | null, scope: string): Promise<BranchInfo | null> {
  if (!branchId) {
    return null;
  }

  const { data, error } = await supabase
    .from('branches')
    .select('id, name, location, city, discount_percentage, active')
    .eq('id', branchId)
    .maybeSingle<BranchInfo>();

  if (error) {
    logWarn(scope, 'Failed to load branch for membership context.', error);
    return null;
  }

  return normalizeBranch(data ?? null);
}

interface MembershipFetchResult {
  member: MemberData | null;
  error: PostgrestError | null;
}

async function resolveMembership(scope: string, userId: string): Promise<MembershipFetchResult> {
  let attempt = 0;
  let lastError: PostgrestError | null = null;

  while (attempt < MEMBER_FETCH_MAX_ATTEMPTS) {
    attempt += 1;
    const { data, error } = await supabase
      .from('memberships')
      .select('membership_active, membership_expires, role, status, branch_id, approved_at')
      .eq('user_id', userId)
      .maybeSingle<MembershipRow>();

    if (error) {
      lastError = error;
      logWarn(scope, `Membership lookup failed (attempt ${attempt}).`, error);
      if (attempt < MEMBER_FETCH_MAX_ATTEMPTS) {
        await delay(MEMBER_FETCH_RETRY_DELAY_MS);
        continue;
      }
      return { member: null, error };
    }

    if (!data) {
      logWarn(scope, `Membership row empty (attempt ${attempt}).`);
      if (attempt < MEMBER_FETCH_MAX_ATTEMPTS) {
        await delay(MEMBER_FETCH_RETRY_DELAY_MS);
        continue;
      }
      return { member: null, error: lastError };
    }

    const [profile, branch] = await Promise.all([
      fetchProfile(userId, scope),
      fetchBranch(data.branch_id ?? null, scope),
    ]);

    const normalized = normalizeMembership(data, profile, branch);
    return { member: normalized, error: null };
  }

  return { member: null, error: lastError };
}

export type MemberContextStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unauthenticated';

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

export default function useMemberContext(options?: UseMemberContextOptions): UseMemberContextValue {
  const { enabled = true, autoResolve = true, onUnauthorized, scope = DEFAULT_SCOPE } = options ?? {};

  const [status, setStatus] = useState<MemberContextStatus>('idle');
  const [member, setMember] = useState<MemberData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedTrustedFallback] = useState(false);
  const lastSyncedAtRef = useRef<string | null>(null);
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

    const unsubscribe = subscribeToRolePreview((nextState) => {
      setPreviewState(nextState);
    });

    return unsubscribe;
  }, [previewFeatureEnabled]);

  const resolveMember = useCallback(async (): Promise<MemberResolutionResult> => {
    if (!enabled) {
      logDebug(scope, 'Member context disabled. Skipping resolution.');
      return {
        status: 'unauthenticated',
        user: null,
        member: null,
        usedTrustedFallback: false,
        lastSyncedAt: lastSyncedAtRef.current,
      };
    }

    setStatus('loading');
    setError(null);

    const { data, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      logError(scope, 'supabase.auth.getSession failed.', sessionError);
    }

    const currentUser = data?.session?.user ?? null;

    if (!currentUser) {
      if (previewFeatureEnabled && previewState.role) {
        const previewMember: MemberData = {
          membership_active: true,
          membership_expires: null,
          status: 'active',
          full_name: previewState.fullName ?? 'Demo User',
          role: (previewState.role ?? 'member') as MemberRole,
          branch_id: previewState.branchId ?? null,
          email: previewState.email ?? 'demo@psychocas.cz',
          approved: true,
          approved_at: null,
          phone: null,
          branch: previewState.branchId
            ? { id: previewState.branchId, name: previewState.branchName ?? 'Demo Branch' }
            : null,
          origin: 'demo',
        };

        lastSyncedAtRef.current = new Date().toISOString();
        setStatus('ready');
        setMember(previewMember);
        setUser(null);
        setError(null);
        return {
          status: 'ready',
          user: null,
          member: previewMember,
          usedTrustedFallback: false,
          lastSyncedAt: lastSyncedAtRef.current,
        };
      }

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

    let ensureError: PostgrestError | null = null;

    try {
      const { error: rpcError } = await supabase.rpc('ensure_membership');
      ensureError = rpcError;
    } catch (rpcError) {
      logWarn(scope, 'ensure_membership RPC threw.', rpcError);
    }

    if (ensureError) {
      logWarn(scope, 'ensure_membership RPC failed.', ensureError);
    }

    let membershipResult = await resolveMembership(scope, currentUser.id);
    let attempt = 1;

    while (!membershipResult.member && attempt < MEMBER_FETCH_MAX_ATTEMPTS) {
      attempt += 1;
      logWarn(scope, `Membership missing. Retrying (${attempt}/${MEMBER_FETCH_MAX_ATTEMPTS}).`);
      await delay(MEMBER_FETCH_RETRY_DELAY_MS);
      membershipResult = await resolveMembership(scope, currentUser.id);
    }

    if (membershipResult.error) {
      logError(scope, 'Membership resolution failed.', membershipResult.error);
    }

    const resolvedMember = membershipResult.member;

    if (resolvedMember) {
      logDebug(scope, 'Membership resolved successfully.');
      lastSyncedAtRef.current = new Date().toISOString();
      setMember(resolvedMember);
      setStatus('ready');
      setError(null);
      return {
        status: 'ready',
        user: currentUser,
        member: resolvedMember,
        usedTrustedFallback: false,
        lastSyncedAt: lastSyncedAtRef.current,
      };
    }

    if (previewFeatureEnabled && previewState.role) {
      const previewMember: MemberData = {
        membership_active: true,
        membership_expires: null,
        status: 'active',
        full_name: previewState.fullName ?? 'Demo User',
        role: (previewState.role ?? 'member') as MemberRole,
        branch_id: previewState.branchId ?? null,
        email: previewState.email ?? 'demo@psychocas.cz',
        approved: true,
        approved_at: null,
        phone: null,
        branch: previewState.branchId
          ? { id: previewState.branchId, name: previewState.branchName ?? 'Demo Branch' }
          : null,
        origin: 'demo',
      };

      lastSyncedAtRef.current = new Date().toISOString();
      setMember(previewMember);
      setStatus('ready');
      setError(null);
      return {
        status: 'ready',
        user: currentUser,
        member: previewMember,
        usedTrustedFallback: false,
        lastSyncedAt: lastSyncedAtRef.current,
      };
    }

    logWarn(scope, 'Membership not found for authenticated user.');
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
    unauthorizedRef.current?.();
    return failure;
  }, [enabled, previewFeatureEnabled, previewState, scope]);

  useEffect(() => {
    if (autoResolve) {
      void resolveMember();
    }
  }, [autoResolve, resolveMember]);

  const refresh = useCallback(async () => {
    const result = await resolveMember();
    return result;
  }, [resolveMember]);

  const value = useMemo<UseMemberContextValue>(
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

  return value;
}
