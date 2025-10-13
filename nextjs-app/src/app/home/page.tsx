'use client';

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Navigation from '@/components/Navigation';
import type { PostgrestResponse, User } from '@supabase/supabase-js';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  MapPin,
  QrCode,
  ShieldAlert,
} from 'lucide-react';
import {
  groupPartnersForMember,
  diagnosePartnerVisibility,
  type PartnerOfferRecord,
} from '@/lib/partners';
import { loadHomeSnapshot, saveHomeSnapshot, clearHomeSnapshot } from '@/lib/offlineCache';
import type { BranchInfo, MemberData, MemberRole, TokenData } from '@/types/member';
import useNetworkStatus from '@/hooks/useNetworkStatus';
import usePwaInstallPrompt from '@/hooks/usePwaInstallPrompt';

const ROLE_LABELS: Record<MemberRole, string> = {
  member: 'Člen',
  manager: 'Manažer',
  council: 'Rada',
  technician: 'Technik',
};

const OFFLINE_REFRESH_MESSAGE = 'Pro obnovení dat se prosím připojte k internetu.';
const OFFLINE_TOKEN_MESSAGE = 'Pro vygenerování nového kódu je nutné připojení k internetu.';
const OFFLINE_CARD_HINT = 'Pro generování nebo obnovu členského kódu je vyžadováno připojení k internetu.';
const TOKEN_QUEUE_MESSAGE = 'Žádost o nový kód bude odeslána, jakmile se znovu připojíte k internetu.';
const REFRESH_GENERIC_ERROR = 'Nepodařilo se obnovit data. Zkuste to prosím znovu.';
const MEMBER_FETCH_MAX_ATTEMPTS = 3;
const MEMBER_FETCH_RETRY_DELAY_MS = 400;

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Primary clipboard API failed, attempting fallback copy.', error);
    }
  }

  if (typeof document === 'undefined' || !document.body) {
    return false;
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (fallbackError) {
    console.warn('Fallback clipboard copy failed.', fallbackError);
    return false;
  }
};

function HomeContent() {
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partners, setPartners] = useState<PartnerOfferRecord[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(true);
  const [partnersError, setPartnersError] = useState<string | null>(null);
  const [token, setToken] = useState<TokenData | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [restoredFromSnapshot, setRestoredFromSnapshot] = useState(false);
  const [snapshotSavedAt, setSnapshotSavedAt] = useState<string | null>(null);
  const [snapshotChecked, setSnapshotChecked] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshStatus, setLastRefreshStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastRefreshAttemptAt, setLastRefreshAttemptAt] = useState<string | null>(null);
  const [pendingTokenRequest, setPendingTokenRequest] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnline = useNetworkStatus();
  const { canInstall, installed, promptInstall } = usePwaInstallPrompt();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'unauthorized') {
      setError('Nemáte oprávnění k přístupu na tuto stránku.');
      const timeout = setTimeout(() => {
        router.replace('/home');
      }, 5000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [router, searchParams]);

  const formatExpiryDate = useCallback((dateStr: string | null) => {
    if (!dateStr) return 'Neuvedeno';
    try {
      return new Intl.DateTimeFormat('cs-CZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(dateStr));
    } catch (dateError) {
      console.error('Error formatting expiry date:', dateError);
      return 'Neuvedeno';
    }
  }, []);

  const formatRemainingTime = useCallback((ms: number) => {
    if (ms <= 0) {
      return 'Vypršel';
    }

    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    const snapshot = loadHomeSnapshot();
    if (snapshot) {
      setMemberData(snapshot.member);
      setPartners(snapshot.partners);
      setToken(snapshot.token);
      setLoading(false);
      setPartnersLoading(false);
      setRestoredFromSnapshot(true);
      setSnapshotSavedAt(snapshot.savedAt);
      setLastSyncedAt(snapshot.savedAt);
      setTokenError(null);
    }
    setSnapshotChecked(true);
  }, []);

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    setError((prev) => (prev === OFFLINE_REFRESH_MESSAGE ? null : prev));
    setTokenError((prev) => (prev === OFFLINE_TOKEN_MESSAGE ? null : prev));
  }, [isOnline]);

  useEffect(() => {
    if (installed) {
      setInstallError(null);
    }
  }, [installed]);

  const loadActiveToken = useCallback(async (userId: string): Promise<TokenData | null> => {
    let activeToken: TokenData | null = null;
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select('code, expires_at')
        .eq('user_id', userId)
        .is('consumed_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error loading active token:', error);
        return null;
      }

      if (data && data.length > 0) {
        activeToken = {
          code: data[0].code,
          expiresAt: data[0].expires_at,
        };
        setToken(activeToken);
        setTokenError(null);
      } else {
        setToken(null);
        setTimeLeft(0);
      }
    } catch (loadError) {
      console.error('Unexpected error loading active token:', loadError);
    }
    return activeToken;
  }, []);

  const fetchMemberContext = useCallback(
    async (options?: { forceLoading?: boolean }): Promise<boolean> => {
      const shouldShowLoaders = options?.forceLoading ?? !restoredFromSnapshot;
      if (shouldShowLoaders) {
        setLoading(true);
        setPartnersLoading(true);
      }

      if (!isOnline) {
        if (shouldShowLoaders) {
          setLoading(false);
          setPartnersLoading(false);
        }
        setError((prev) => prev ?? OFFLINE_REFRESH_MESSAGE);
        return false;
      }
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        console.log('🔍 DEBUG: currentUser from getUser():', currentUser);

        if (!currentUser) {
          console.log('❌ No currentUser found, redirecting to login');
          setLoading(false);
          setPartnersLoading(false);
          router.push('/login');
          return false;
        }

        console.log('✅ CurrentUser found:', { id: currentUser.id, email: currentUser.email });
        setUser(currentUser);

        const trustedUserEmailRaw = currentUser.email ?? null;
        const trustedUserEmail = trustedUserEmailRaw?.trim().toLowerCase() ?? null;

        const escapeIlikePattern = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

        const fetchTrustedUserFallback = async (): Promise<MemberData | null> => {
          if (!trustedUserEmail) {
            return null;
          }

          type TrustedUserRow = {
            first_name: string | null;
            last_name: string | null;
            role: string | null;
            branch_id: string | null;
            branch?: BranchInfo | BranchInfo[] | null;
          };

          const emailPatterns = Array.from(
            new Set(
              [trustedUserEmailRaw, trustedUserEmail]
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
              `first_name, last_name, role, branch_id,
               branch:branch_id (id, name, location, city, discount_percentage, active)`
            )
            .limit(1);

          if (emailPatterns.length === 1) {
            trustedQuery = trustedQuery.filter('email', 'ilike', emailPatterns[0]!);
          } else {
            trustedQuery = trustedQuery.or(
              emailPatterns.map((pattern) => `email.ilike.${pattern}`).join(',')
            );
          }

          const { data, error } = await trustedQuery;

          if (error) {
            console.error('Error loading trusted user fallback:', error);
            return null;
          }

          const trustedRecord = data?.[0];
          if (!trustedRecord) {
            return null;
          }

          const fallbackBranch = Array.isArray(trustedRecord.branch)
            ? trustedRecord.branch[0] ?? null
            : trustedRecord.branch ?? null;

          const nameParts = [trustedRecord.first_name, trustedRecord.last_name].filter(
            (part): part is string => typeof part === 'string' && part.trim().length > 0
          );

          const fallbackMember: MemberData = {
            membership_active: true,
            membership_expires: null,
            full_name: nameParts.length > 0 ? nameParts.join(' ') : null,
            role: (trustedRecord.role ?? 'member') as MemberRole,
            branch_id: trustedRecord.branch_id ?? null,
            email: currentUser.email ?? null,
            approved: true,
            approved_at: null,
            branch: fallbackBranch,
          };

          console.info('ℹ️ Using trusted_users fallback for member context.');
          return fallbackMember;
        };

        // Robust member query with graceful fallbacks when optional columns are missing
        type MemberRow = {
          membership_active: boolean;
          membership_expires: string | null;
          full_name: string | null;
          role: string | null;
          branch_id: string | null;
          email?: string | null;
          approved?: boolean | null;
          approved_at?: string | null;
          branch?: BranchInfo | BranchInfo[] | null;
        };

        const selectFull = `
          membership_active,
          membership_expires,
          full_name,
          role,
          branch_id,
          email,
          approved,
          approved_at,
          branch:branch_id (
            id,
            name,
            location,
            city,
            discount_percentage,
            active
          )
        `;

        const selectReducedBranch = `
          membership_active,
          membership_expires,
          full_name,
          role,
          branch_id,
          email,
          approved,
          approved_at,
          branch:branch_id (
            id,
            name
          )
        `;

        const selectNoBranch = `
          membership_active,
          membership_expires,
          full_name,
          role,
          branch_id,
          email,
          approved,
          approved_at
        `;

        type MemberQueryResponse = PostgrestResponse<MemberRow>;

        async function fetchMemberWithFallback(): Promise<MemberQueryResponse> {
          // 1) Try full selection (may fail on minimal DB)
          let res: MemberQueryResponse = await supabase
            .from<MemberRow>('members')
            .select(selectFull)
            .eq('user_id', currentUser.id)
            .limit(1);
          if (!res.error) return res;

          // If undefined column (42703), retry with reduced branch
          if (res.error?.code === '42703') {
            console.warn('Member query: falling back to reduced branch selection (missing columns).', res.error);
            res = await supabase
              .from<MemberRow>('members')
              .select(selectReducedBranch)
              .eq('user_id', currentUser.id)
              .limit(1);
            if (!res.error) return res;
          }

          // Final fallback – no branch join
          console.warn('Member query: falling back to no-branch selection.', res.error);
          res = await supabase
            .from<MemberRow>('members')
            .select(selectNoBranch)
            .eq('user_id', currentUser.id)
            .limit(1);
          return res;
        }

        const partnersPromise = supabase
          .from('partner_offers')
          .select(
            `id, title, description, discount_code, discount_percentage, scope, branch_id, city, active,
             branch:branch_id (id, name, city)`
          )
          .order('title');

        let memberResponse = await fetchMemberWithFallback();
        let memberAttempts = 1;

        while (
          !memberResponse.error &&
          (!memberResponse.data || memberResponse.data.length === 0) &&
          memberAttempts < MEMBER_FETCH_MAX_ATTEMPTS
        ) {
          memberAttempts += 1;
          console.warn(
            `⚠️ Member data empty on attempt ${memberAttempts - 1}. Retrying (${memberAttempts}/${MEMBER_FETCH_MAX_ATTEMPTS})...`
          );
          await delay(MEMBER_FETCH_RETRY_DELAY_MS);
          memberResponse = await fetchMemberWithFallback();
        }

        const partnersResponse = await partnersPromise;
        console.log('🔍 DEBUG: memberResponse', { memberResponse, memberAttempts });

        let normalizedMember: MemberData | null = null;
        let normalizedPartners: PartnerOfferRecord[] = [];

        if (memberResponse.error) {
          console.error('Error fetching member data:', memberResponse.error);
          setMemberData(null);
          setError((prev) => prev ?? 'Nepodařilo se načíst informace o členství.');
        } else {
          type MemberRow = {
            membership_active: boolean;
            membership_expires: string | null;
            full_name: string | null;
            role: string | null;
            branch_id: string | null;
            email?: string | null;
            approved?: boolean | null;
            approved_at?: string | null;
            branch: BranchInfo | BranchInfo[] | null;
          };

          const memberRows = (memberResponse.data ?? []) as MemberRow[];
          const memberRow = memberRows[0] ?? null;

          if (memberRow) {
            const normalizedBranch = Array.isArray(memberRow.branch)
              ? memberRow.branch[0] ?? null
              : memberRow.branch ?? null;

            normalizedMember = {
              membership_active: memberRow.membership_active,
              membership_expires: memberRow.membership_expires,
              full_name: memberRow.full_name,
              role: (memberRow.role ?? 'member') as MemberRole,
              branch_id: memberRow.branch_id,
              email: memberRow.email ?? null,
              approved: memberRow.approved ?? null,
              approved_at: memberRow.approved_at ?? null,
              branch: normalizedBranch,
            };
          } else {
            console.warn('⚠️ No member row found for current user. Attempting trusted_users fallback.');
            normalizedMember = await fetchTrustedUserFallback();
          }

          setMemberData(normalizedMember);
        }

        if (partnersResponse.error) {
          console.error('Error fetching partner data:', partnersResponse.error);
          setPartners([]);
          setPartnersError('Nepodařilo se načíst partnerské podniky.');
        } else {
          type PartnerRow = PartnerOfferRecord & {
            branch: PartnerOfferRecord['branch'] | PartnerOfferRecord['branch'][] | null;
          };

          const partnerRows = (partnersResponse.data ?? []) as PartnerRow[];
          normalizedPartners = partnerRows.map((partner) => ({
            ...partner,
            branch: Array.isArray(partner.branch)
              ? partner.branch[0] ?? null
              : partner.branch ?? null,
          }));

          setPartners(normalizedPartners);
          setPartnersError(null);
        }

        const activeToken = await loadActiveToken(currentUser.id);

        const hasMemberError = Boolean(memberResponse.error);
        const hasPartnerError = Boolean(partnersResponse.error);
        const requestSuccessful = !hasMemberError && !hasPartnerError;

        if (requestSuccessful) {
          const saved = saveHomeSnapshot({
            member: normalizedMember,
            partners: normalizedPartners,
            token: activeToken,
          });
          setRestoredFromSnapshot(false);
          setSnapshotSavedAt(null);
          setLastSyncedAt(saved.savedAt);
          return true;
        }
      } catch (fetchError) {
        console.error('Unexpected error loading home screen:', fetchError);
        setError((prev) => prev ?? 'Došlo k neočekávané chybě při načítání údajů.');
        return false;
      } finally {
        setLoading(false);
        setPartnersLoading(false);
      }
      return false;
    },
    [isOnline, loadActiveToken, restoredFromSnapshot, router]
  );

  useEffect(() => {
    if (!snapshotChecked) {
      return;
    }

    let cancelled = false;
    const attemptTimestamp = new Date().toISOString();

    const loadContext = async () => {
      const success = await fetchMemberContext();
      if (cancelled) {
        return;
      }
      setLastRefreshAttemptAt(attemptTimestamp);
      setLastRefreshStatus(success ? 'success' : 'error');
      if (!success && isOnline) {
        setError((prev) => prev ?? REFRESH_GENERIC_ERROR);
      }
    };

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, [fetchMemberContext, isOnline, snapshotChecked]);

  useEffect(() => {
    if (!token) {
      setTimeLeft(0);
      return;
    }

    const updateRemaining = () => {
      const expiryTimestamp = new Date(token.expiresAt).getTime();
      const remaining = Math.max(0, expiryTimestamp - Date.now());
      setTimeLeft(remaining);

      if (remaining === 0) {
        setToken(null);
      }
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);

    return () => window.clearInterval(interval);
  }, [token]);

  useEffect(() => {
    setCopied(false);
  }, [token?.code]);

  const handleSignOut = async () => {
    clearHomeSnapshot();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleGenerateToken = useCallback(async () => {
    if (!memberData || !memberData.membership_active || !(memberData.approved ?? true)) {
      return;
    }

    setPendingTokenRequest(false);
    setTokenLoading(true);
    setTokenError(null);

    if (!isOnline) {
      setTokenLoading(false);
      setTokenError(OFFLINE_TOKEN_MESSAGE);
      setPendingTokenRequest(true);
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || !session.user) {
        setTokenLoading(false);
        router.push('/login');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate_token`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Nepodařilo se vygenerovat kód.');
      }

      const payload = await response.json();
      const expiresAt = payload?.expiresAt ?? payload?.expires_at;

      if (!payload?.code || !expiresAt) {
        throw new Error('Odpověď neobsahuje platný kód.');
      }

      setToken({ code: payload.code, expiresAt });
      setTimeLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
      setTokenError(null);
      setPendingTokenRequest(false);
    } catch (generationError) {
      console.error('Error generating token:', generationError);
      setTokenError(
        generationError instanceof Error
          ? generationError.message
          : 'Nastala neočekávaná chyba při generování kódu.'
      );
    } finally {
      setTokenLoading(false);
    }
  }, [isOnline, memberData, router]);

  const handleCopyCode = useCallback(async () => {
    if (!token?.code) return;

    const success = await copyTextToClipboard(token.code);
    if (success) {
      setTokenError(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      setTokenError('Nepodařilo se zkopírovat kód do schránky.');
    }
  }, [token]);

  const handleInstallClick = useCallback(async () => {
    setInstallError(null);
    try {
      const result = await promptInstall();
      if (result.outcome === 'unavailable') {
        setInstallError('Instalaci je potřeba spustit přímo z nabídky prohlížeče „Přidat na plochu“.');
      } else if (result.outcome === 'dismissed') {
        setInstallError('Instalace byla zrušena. Zkuste to prosím znovu později.');
      }
    } catch (installErrorInstance) {
      console.error('Error triggering PWA install:', installErrorInstance);
      setInstallError('Instalaci se nepodařilo spustit. Zkuste to prosím znovu.');
    }
  }, [promptInstall]);

  const partnerGroups = useMemo(
    () => groupPartnersForMember(partners, memberData?.branch_id ?? null),
    [partners, memberData?.branch_id]
  );

  const partnerDiagnostics = useMemo(
    () => diagnosePartnerVisibility(memberData?.branch_id ?? null, partnerGroups),
    [memberData?.branch_id, partnerGroups]
  );

  const offlineSnapshotLabel = useMemo(() => {
    if (!snapshotSavedAt) return null;
    try {
      return new Intl.DateTimeFormat('cs-CZ', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(snapshotSavedAt));
    } catch (formatError) {
      console.error('Error formatting snapshot timestamp:', formatError);
      return snapshotSavedAt;
    }
  }, [snapshotSavedAt]);

  const lastSyncedLabel = useMemo(() => {
    if (!lastSyncedAt) return null;
    try {
      return new Intl.DateTimeFormat('cs-CZ', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(lastSyncedAt));
    } catch (formatError) {
      console.error('Error formatting last synced timestamp:', formatError);
      return lastSyncedAt;
    }
  }, [lastSyncedAt]);

  const lastRefreshAttemptLabel = useMemo(() => {
    if (!lastRefreshAttemptAt) return null;
    try {
      return new Intl.DateTimeFormat('cs-CZ', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(lastRefreshAttemptAt));
    } catch (formatError) {
      console.error('Error formatting refresh attempt timestamp:', formatError);
      return lastRefreshAttemptAt;
    }
  }, [lastRefreshAttemptAt]);

  const handleRefresh = useCallback(async () => {
    const attemptTimestamp = new Date().toISOString();

    if (!isOnline) {
      setError(OFFLINE_REFRESH_MESSAGE);
      setLastRefreshStatus('error');
      setLastRefreshAttemptAt(attemptTimestamp);
      return;
    }

    setIsRefreshing(true);
    setError(null);
    setPartnersError(null);
    try {
      const success = await fetchMemberContext({ forceLoading: true });
      setLastRefreshStatus(success ? 'success' : 'error');
      setLastRefreshAttemptAt(attemptTimestamp);
      if (!success) {
        setError((prev) => prev ?? REFRESH_GENERIC_ERROR);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchMemberContext, isOnline]);

  const renderPartnerCard = useCallback((partner: PartnerOfferRecord) => {
    const locationLabel = partner.city || partner.branch?.city || partner.branch?.name || null;
    const hasDiscount = typeof partner.discount_percentage === 'number' && !Number.isNaN(partner.discount_percentage);
    const branchLabel = partner.scope === 'local' ? partner.branch?.name ?? null : null;

    return (
      <div
        key={partner.id}
        className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
        style={{ borderColor: '#e0e0e0', backgroundColor: '#f9fafb' }}
      >
        <div>
          <p className="font-medium" style={{ color: '#333333' }}>{partner.title}</p>
          {locationLabel && (
            <p className="mt-1 flex items-center gap-2 text-sm" style={{ color: '#666666' }}>
              <MapPin className="h-4 w-4" />
              {locationLabel}
            </p>
          )}
          {branchLabel && (
            <p className="mt-1 text-xs font-medium uppercase tracking-wide" style={{ color: '#1d4f7d' }}>
              Pobočka: {branchLabel}
            </p>
          )}
          {partner.description && (
            <p className="mt-2 text-sm" style={{ color: '#4b5563' }}>{partner.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {partner.discount_code && (
            <span
              className="px-3 py-1 text-xs font-semibold uppercase"
              style={{
                backgroundColor: '#ede9fe',
                color: '#5b21b6',
                borderRadius: '9999px',
                letterSpacing: '0.08em',
              }}
            >
              {partner.discount_code}
            </span>
          )}
          {hasDiscount && (
          <span
            className="px-3 py-1 text-sm font-semibold"
            style={{
              backgroundColor: '#e1f5fe',
              color: '#0277bd',
              borderRadius: '9999px',
            }}
          >
            -{partner.discount_percentage}%
          </span>
          )}
        </div>
      </div>
    );
  }, []);

  const isApproved = memberData?.approved ?? true;
  const canGenerateToken = Boolean(memberData?.membership_active) && isApproved;
  const branchName = memberData?.branch?.name ?? null;
  const branchLocation = memberData?.branch?.location || memberData?.branch?.city || null;
  const memberEmail = memberData?.email || user?.email || '';
  const partnerSectionHasContent = partnerGroups.national.length > 0 || partnerGroups.local.length > 0;
  const showManagementShortcuts = memberData ? ['manager', 'council', 'technician'].includes(memberData.role) : false;
  const showPartnerDiagnostics = showManagementShortcuts;

  useEffect(() => {
    if (isOnline && pendingTokenRequest && canGenerateToken && !tokenLoading) {
      void handleGenerateToken();
    }
  }, [canGenerateToken, handleGenerateToken, isOnline, pendingTokenRequest, tokenLoading]);

  if (loading) {
    return (
      <main className="psychocas-section flex items-center justify-center">
        <div className="text-center fade-in-up">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: '#1d4f7d' }}></div>
          <p style={{ color: '#666666' }}>Načítám...</p>
        </div>
      </main>
    );
  }

  if (!memberData) {
    return (
      <main className="psychocas-section flex items-center justify-center">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card text-center">
            <div className="text-4xl mb-4" style={{ color: '#c62828' }}>⚠️</div>
            <h2 className="mb-2">Člen nenalezen</h2>
            <p className="mb-6" style={{ color: '#666666' }}>
              Tvůj účet není registrován jako člen spolku
            </p>
            <button
              onClick={handleSignOut}
              className="psychocas-button-primary"
              style={{ backgroundColor: '#c62828' }}
            >
              Odhlásit se
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="psychocas-section pb-24">
      <div className="psychocas-container space-y-6 fade-in-up pt-6 pb-24">
        {error && (
          <div className="psychocas-card" style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #c62828' }}>
            <div className="flex items-center gap-3">
              <div className="text-2xl">⚠️</div>
              <p style={{ color: '#c62828', fontWeight: 500 }}>{error}</p>
            </div>
          </div>
        )}

        {restoredFromSnapshot && offlineSnapshotLabel && (
          <div
            className="psychocas-card"
            style={{ backgroundColor: '#eff6ff', borderLeft: '4px solid #1d4f7d' }}
          >
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 flex-shrink-0" style={{ color: '#1d4f7d' }} />
              <div className="space-y-1">
                <h3 className="text-base font-semibold" style={{ color: '#1d4f7d' }}>
                  Offline režim
                </h3>
                <p className="text-sm" style={{ color: '#1d4f7d' }}>
                  Zobrazujeme uložená data ze {offlineSnapshotLabel}. Po připojení k internetu se údaje
                  automaticky aktualizují.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {lastRefreshStatus !== 'idle' && lastRefreshAttemptLabel && (
            <div className="flex items-center gap-2 text-sm" style={{ color: lastRefreshStatus === 'success' ? '#047857' : '#b91c1c' }}>
              {lastRefreshStatus === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <span>
                {lastRefreshStatus === 'success'
                  ? `Obnoveno ${lastRefreshAttemptLabel}`
                  : `Obnovení selhalo ${lastRefreshAttemptLabel}`}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || !isOnline}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            style={{
              borderColor: '#1d4f7d',
              color: isRefreshing || !isOnline ? '#9ca3af' : '#1d4f7d',
              backgroundColor: isRefreshing ? '#e5e7eb' : '#ffffff',
              cursor: isRefreshing || !isOnline ? 'not-allowed' : 'pointer',
            }}
          >
            {isRefreshing ? 'Aktualizuji…' : 'Obnovit data'}
          </button>
        </div>

        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <svg width="80" height="80" viewBox="-60 -60 120 120" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="homeLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#1d4f7d', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#049edb', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              <circle cx="0" cy="0" r="55" fill="url(#homeLogoGradient)" />
              <circle cx="0" cy="0" r="50" fill="none" stroke="white" strokeWidth={6} />
              <line x1="0" y1="0" x2="-15" y2="-25" stroke="white" strokeWidth={5} strokeLinecap="round" />
              <line x1="0" y1="0" x2="25" y2="-15" stroke="white" strokeWidth={4} strokeLinecap="round" />
              <circle cx="0" cy="0" r="6" fill="white" />
              <circle cx="0" cy="-40" r="4" fill="white" />
              <circle cx="40" cy="0" r="4" fill="white" />
              <circle cx="0" cy="40" r="4" fill="white" />
              <circle cx="-40" cy="0" r="4" fill="white" />
            </svg>
          </div>
          <h1 className="mb-2">Vítejte zpět!</h1>
          <p style={{ color: '#666666' }}>{memberData.full_name || memberEmail}</p>
        </div>

        <div className="psychocas-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h2 style={{ color: '#333333' }}>Stáhněte si Psychočas do zařízení</h2>
              <p className="text-sm" style={{ color: '#666666' }}>
                Instalací aplikace na plochu můžete využívat členský průkaz i bez připojení k internetu.
              </p>
              {!canInstall && !installed && (
                <p className="text-xs" style={{ color: '#1d4f7d' }}>
                  Pokud tlačítko není aktivní, otevřete nabídku prohlížeče a zvolte možnost „Přidat na plochu“.
                </p>
              )}
              {installed && (
                <p className="text-xs" style={{ color: '#047857' }}>
                  Aplikace je již nainstalována na tomto zařízení.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleInstallClick}
              disabled={!canInstall || installed}
              className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                backgroundColor: !canInstall || installed ? '#e5e7eb' : '#1d4f7d',
                color: !canInstall || installed ? '#9ca3af' : '#ffffff',
                cursor: !canInstall || installed ? 'not-allowed' : 'pointer',
                minWidth: '12rem',
              }}
            >
              <Download className="h-4 w-4" />
              Stáhnout aplikaci
            </button>
          </div>
          {canInstall && !installed && (
            <p className="mt-3 text-xs" style={{ color: '#666666' }}>
              Po stisknutí tlačítka potvrďte instalaci v dialogu vašeho prohlížeče.
            </p>
          )}
          {installError && (
            <p className="mt-3 text-sm" style={{ color: '#b91c1c' }}>{installError}</p>
          )}
        </div>

        {memberData.approved === false && (
          <div className="psychocas-card" style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74' }}>
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 flex-shrink-0" style={{ color: '#c2410c' }} />
              <div className="space-y-1">
                <h3 className="text-base font-semibold" style={{ color: '#c2410c' }}>Čeká na schválení</h3>
                <p className="text-sm" style={{ color: '#9a3412' }}>
                  Vaše přihláška je v procesu ověření. Jakmile vás tým Psychočas schválí, zpřístupní se všechny členské výhody.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="psychocas-card">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 style={{ color: '#333333' }}>Členský profil</h2>
              <p className="text-sm" style={{ color: '#666666' }}>{memberEmail}</p>
              {lastSyncedLabel && (
                <p className="text-xs" style={{ color: '#9ca3af' }}>
                  Naposledy aktualizováno: {lastSyncedLabel}
                </p>
              )}
            </div>
            <span
              className="px-3 py-1 text-sm font-medium"
              style={{
                backgroundColor: '#e3f2fd',
                color: '#1d4f7d',
                borderRadius: '9999px',
              }}
            >
              {ROLE_LABELS[memberData.role]}
            </span>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span style={{ color: '#666666' }}>Stav členství</span>
              <span
                className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                  memberData.membership_active ? 'status-active' : 'status-inactive'
                }`}
              >
                {memberData.membership_active ? '✓ Aktivní' : '✗ Neaktivní'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: '#666666' }}>Platnost do</span>
              <span style={{ color: '#333333', fontWeight: 500 }}>{formatExpiryDate(memberData.membership_expires)}</span>
            </div>
            {branchName && (
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: '#f8fafc' }}>
                <p className="text-xs uppercase tracking-wide" style={{ color: '#1d4f7d', fontWeight: 600 }}>Lokální pobočka</p>
                <p className="mt-1 text-sm" style={{ color: '#333333' }}>
                  {branchName}
                  {branchLocation ? ` • ${branchLocation}` : ''}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="psychocas-card">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 style={{ color: '#333333' }}>Digitální členská karta</h2>
              <p className="text-sm" style={{ color: '#666666' }}>
                Prokažte se kódem u partnerských podniků Psychočas. Kód je platný 3 minuty.
              </p>
            </div>
            {token && timeLeft > 0 && (
              <span className="flex items-center gap-1 text-sm font-medium" style={{ color: '#2e7d32' }}>
                <CheckCircle2 className="h-5 w-5" />
                Platný
              </span>
            )}
          </div>

          <div className="mt-6 space-y-4">
            {!isOnline && (
              <div
                className="rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: '#f97316', backgroundColor: '#fff7ed', color: '#9a3412' }}
              >
                {OFFLINE_CARD_HINT}
              </div>
            )}
            {pendingTokenRequest && !isOnline && (
              <p className="text-sm" style={{ color: '#1d4f7d' }}>
                {TOKEN_QUEUE_MESSAGE}
              </p>
            )}
            {token ? (
              <div className="rounded-2xl border px-4 py-5" style={{ borderColor: '#bbdefb', backgroundColor: '#e3f2fd' }}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide" style={{ color: '#1d4f7d', fontWeight: 600 }}>Hash kód</p>
                    <p className="mt-2 font-mono text-2xl" style={{ color: '#1d4f7d', letterSpacing: '0.2rem' }}>{token.code}</p>
                  </div>
                  <CheckCircle2 className="h-10 w-10" style={{ color: '#2e7d32' }} />
                </div>
                <div className="mt-4 flex items-center justify-between text-sm" style={{ color: '#1d4f7d' }}>
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {formatRemainingTime(timeLeft)}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    disabled={timeLeft <= 0}
                    className="flex items-center gap-2"
                    style={{
                      color: timeLeft <= 0 ? '#94a3b8' : '#1d4f7d',
                      cursor: timeLeft <= 0 ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    Kopírovat
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="rounded-2xl border border-dashed px-4 py-5 text-sm"
                style={{ borderColor: '#cbd5f5', backgroundColor: '#f8fafc', color: '#666666' }}
              >
                Zatím nemáte aktivní kód. Klikněte na tlačítko níže a vytvořte si nový.
              </div>
            )}

            {tokenError && (
              <p className="text-sm" style={{ color: '#c62828' }}>{tokenError}</p>
            )}
            {copied && (
              <p className="text-xs" style={{ color: '#2e7d32' }}>Kód byl zkopírován do schránky.</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={handleGenerateToken}
                disabled={!canGenerateToken || tokenLoading}
                className="psychocas-button-primary"
              >
                {tokenLoading ? 'Generuji…' : token ? 'Obnovit kód' : 'Vygenerovat kód'}
              </button>
              <button
                onClick={() => router.push('/redeem')}
                className="psychocas-button-secondary"
              >
                <QrCode className="h-5 w-5" />
                Zobrazit QR
              </button>
            </div>

            {!canGenerateToken && (
              <p className="text-sm" style={{ color: '#c62828' }}>
                {memberData.approved === false
                  ? 'Kód bude dostupný ihned po schválení členství.'
                  : 'Pro generování kódu je potřeba mít aktivní členství.'}
              </p>
            )}
          </div>
        </div>

        <div className="psychocas-card">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 style={{ color: '#333333' }}>Partnerské podniky</h2>
              <p className="text-sm" style={{ color: '#666666' }}>
                Vyberte si z celostátních i lokálních partnerů a čerpejte členské slevy.
              </p>
            </div>
            <MapPin className="h-6 w-6" style={{ color: '#1d4f7d' }} />
          </div>

          {partnersLoading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#1d4f7d' }}></div>
            </div>
          ) : !isApproved ? (
            <p className="text-sm" style={{ color: '#c2410c' }}>
              Jakmile bude vaše členství schváleno, zobrazí se zde celostátní i lokální nabídky vašeho regionu.
            </p>
          ) : (
            <div className="space-y-5">
              {partnerGroups.national.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1d4f7d' }}>Celorepublikové výhody</h3>
                  {partnerGroups.national.map(renderPartnerCard)}
                </div>
              )}
              {partnerGroups.local.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1d4f7d' }}>
                    Lokální partneři{branchLocation ? ` – ${branchLocation}` : ''}
                  </h3>
                  {partnerGroups.local.map(renderPartnerCard)}
                </div>
              )}
              {!partnerSectionHasContent && !partnersError && (
                <p className="text-sm" style={{ color: '#666666' }}>
                  Zatím zde nejsou zveřejněni žádní partneři. Jakmile budou k dispozici, objeví se na tomto místě.
                </p>
              )}
              {partnersError && (
                <p className="text-sm" style={{ color: '#c62828' }}>{partnersError}</p>
              )}
              {showPartnerDiagnostics && (
                <div
                  className={`rounded-lg border px-4 py-3 ${
                    partnerDiagnostics.hasIssues ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'
                  }`}
                >
                  <p
                    className="text-sm font-semibold"
                    style={{ color: partnerDiagnostics.hasIssues ? '#b91c1c' : '#047857' }}
                  >
                    Kontrola viditelnosti partnerů:
                    {' '}
                    {partnerDiagnostics.hasIssues ? 'vyžaduje pozornost' : 'vše v pořádku'}
                  </p>
                  {partnerDiagnostics.hasIssues ? (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs" style={{ color: '#991b1b' }}>
                      {partnerDiagnostics.hiddenEligible.length > 0 && (
                        <li>
                          {partnerDiagnostics.hiddenEligible.length} lokálních nabídek odpovídá vaší pobočce, ale zůstává skryto.
                        </li>
                      )}
                      {partnerDiagnostics.extraneousLocal.length > 0 && (
                        <li>
                          {partnerDiagnostics.extraneousLocal.length} zobrazených lokálních nabídek neodpovídá přiřazené pobočce.
                        </li>
                      )}
                      {partnerDiagnostics.extraneousNational.length > 0 && (
                        <li>
                          {partnerDiagnostics.extraneousNational.length} nabídek je označeno jako celostátní, ale nesplňuje tuto podmínku.
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs" style={{ color: '#047857' }}>
                      Všechny zobrazené nabídky odpovídají aktuálnímu přiřazení člena.
                    </p>
                  )}
                  {partnerGroups.excluded.length > 0 && !partnerDiagnostics.hasIssues && (
                    <p className="mt-2 text-xs" style={{ color: '#4b5563' }}>
                      Skrytých nabídek mimo vaši pobočku: {partnerGroups.excluded.length}.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {showManagementShortcuts && (
          <div className="psychocas-card">
            <h2 className="mb-4" style={{ color: '#333333' }}>Správa a statistiky</h2>
            <div className="space-y-3">
              {(memberData.role === 'manager' || memberData.role === 'council') && (
                <>
                  <button
                    onClick={() => router.push('/validate')}
                    className="w-full flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors duration-300 hover:bg-gray-50"
                    style={{ borderColor: '#e0e0e0', color: '#333333' }}
                  >
                    <span>Validovat kód</span>
                    <span style={{ color: '#1d4f7d' }}>→</span>
                  </button>
                  <button
                    onClick={() => router.push('/stats')}
                    className="w-full flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors duration-300 hover:bg-gray-50"
                    style={{ borderColor: '#e0e0e0', color: '#333333' }}
                  >
                    <span>Statistiky</span>
                    <span style={{ color: '#1d4f7d' }}>→</span>
                  </button>
                </>
              )}
              {memberData.role === 'technician' && (
                <button
                  onClick={() => router.push('/technician')}
                  className="w-full flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors duration-300 hover:bg-gray-50"
                  style={{ borderColor: '#e0e0e0', color: '#333333' }}
                >
                  <span>Technická správa</span>
                  <span style={{ color: '#1d4f7d' }}>→</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <Navigation userRole={memberData.role} />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="psychocas-section flex items-center justify-center">
        <div className="text-center fade-in-up">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: '#1d4f7d' }}></div>
          <p style={{ color: '#666666' }}>Načítám...</p>
        </div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  );
}
