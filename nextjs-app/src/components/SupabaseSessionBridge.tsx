'use client';

import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { logDebug, logError, logInfo, logWarn } from '@/lib/logging';

const STORAGE_SCOPE = 'supabase-session-bridge';
const SESSION_CACHE_KEY = 'psychocas.auth.session.cache';

interface PersistedSession {
  access_token: string;
  refresh_token: string;
  expires_at: number | null;
}

function persistSession(session: Session | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_CACHE_KEY);
    logDebug(STORAGE_SCOPE, 'Session cleared from cache.');
    return;
  }

  const snapshot: PersistedSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? null,
  };

  window.localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(snapshot));
  logDebug(STORAGE_SCOPE, 'Session persisted to cache.', {
    expires_at: snapshot.expires_at,
  });
}

function readPersistedSession(): PersistedSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_CACHE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSession> | null;

    if (
      !parsed ||
      typeof parsed.access_token !== 'string' ||
      parsed.access_token.length === 0 ||
      typeof parsed.refresh_token !== 'string' ||
      parsed.refresh_token.length === 0
    ) {
      return null;
    }

    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      expires_at: typeof parsed.expires_at === 'number' ? parsed.expires_at : null,
    };
  } catch (parseError) {
    logWarn(STORAGE_SCOPE, 'Failed to parse cached session.', parseError);
    return null;
  }
}

function clearPersistedSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(SESSION_CACHE_KEY);
}

export default function SupabaseSessionBridge(): null {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let mounted = true;

    const bootstrapSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (error) {
        logError(STORAGE_SCOPE, 'supabase.auth.getSession failed.', error);
        return;
      }

      const session = data?.session ?? null;
      persistSession(session);

      if (session) {
        logDebug(STORAGE_SCOPE, 'Active session detected on bootstrap.');
        return;
      }

      const cached = readPersistedSession();

      if (!cached) {
        logDebug(STORAGE_SCOPE, 'No cached session found.');
        return;
      }

      logInfo(STORAGE_SCOPE, 'Restoring Supabase session from cache.');

      const { error: restoreError } = await supabase.auth.setSession({
        access_token: cached.access_token,
        refresh_token: cached.refresh_token,
      });

      if (restoreError) {
        logWarn(STORAGE_SCOPE, 'Failed to restore session from cache. Clearing stale cache.', restoreError);
        clearPersistedSession();
      }
    };

    void bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      persistSession(session ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
