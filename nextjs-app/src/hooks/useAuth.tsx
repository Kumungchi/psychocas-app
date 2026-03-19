'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { logError, logWarn } from '@/lib/logging';

type AuthStatus = 'loading' | 'ready' | 'unauthenticated' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  error: string | null;
  refresh: () => Promise<Session | null>;
  ensureMembership: () => Promise<boolean>;
  lastEnsuredUserId: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastEnsuredUserId, setLastEnsuredUserId] = useState<string | null>(null);
  const ensuredUserRef = useRef<string | null>(null);

  const ensureMembershipForSession = useCallback(
    async (targetSession: Session | null): Promise<boolean> => {
      const userId = targetSession?.user?.id ?? null;

      if (!userId) {
        ensuredUserRef.current = null;
        setLastEnsuredUserId(null);
        return false;
      }

      if (ensuredUserRef.current === userId) {
        return true;
      }

      const { error: ensureError } = await supabase.rpc('ensure_membership_from_whitelist');
      if (ensureError) {
        logWarn('auth-provider', 'ensure_membership_from_whitelist RPC failed', ensureError);
        return false;
      }

      ensuredUserRef.current = userId;
      setLastEnsuredUserId(userId);
      return true;
    },
    []
  );

  const hydrateSession = useCallback(async (): Promise<Session | null> => {
    const {
      data: { session: nextSession } = { session: null },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      logError('auth-provider', 'Failed to load session during hydration.', sessionError);
      setError('Nepodařilo se načíst přihlášení.');
      setStatus('error');
      setSession(null);
      return null;
    }

    setSession(nextSession);
    setError(null);
    setStatus(nextSession ? 'ready' : 'unauthenticated');

    if (nextSession) {
      void ensureMembershipForSession(nextSession);
    } else {
      ensuredUserRef.current = null;
      setLastEnsuredUserId(null);
    }

    return nextSession;
  }, [ensureMembershipForSession]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auth hydration on mount
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT' || !nextSession) {
        ensuredUserRef.current = null;
        setLastEnsuredUserId(null);
        setSession(null);
        setStatus('unauthenticated');
        setError(null);
        return;
      }

      setSession(nextSession);
      setStatus('ready');
      setError(null);

      if (['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED'].includes(event)) {
        void ensureMembershipForSession(nextSession);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [ensureMembershipForSession]);

  const ensureMembership = useCallback(async (): Promise<boolean> => {
    if (!session) {
      ensuredUserRef.current = null;
      setLastEnsuredUserId(null);
      return false;
    }

    return ensureMembershipForSession(session);
  }, [ensureMembershipForSession, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      error,
      refresh: hydrateSession,
      ensureMembership,
      lastEnsuredUserId,
    }),
    [ensureMembership, error, hydrateSession, lastEnsuredUserId, session, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
