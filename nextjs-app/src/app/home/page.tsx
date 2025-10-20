'use client';

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Navigation from '@/components/Navigation';
import ProfileDrawer from '@/components/ProfileDrawer';
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
import type { MemberData, TokenData } from '@/types/member';
import useNetworkStatus from '@/hooks/useNetworkStatus';
import usePwaInstallPrompt from '@/hooks/usePwaInstallPrompt';
import useMemberContext from '@/hooks/useMemberContext';
import useLocale from '@/hooks/useLocale';
import { logDebug, logError, logWarn } from '@/lib/logging';
import Button from '@/ui/components/Button';
import Card from '@/ui/components/Card';
import Badge from '@/ui/components/Badge';
import {
  asTranslationKey,
  resolveTranslatable,
  getDateLocale,
} from '@/lib/i18n/utils';

const OFFLINE_REFRESH_MESSAGE = asTranslationKey('home.errors.offlineRefresh');
const OFFLINE_TOKEN_MESSAGE = asTranslationKey('home.errors.offlineToken');
const REFRESH_GENERIC_ERROR = asTranslationKey('home.errors.genericRefresh');
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
      logWarn('clipboard', 'Primary clipboard API failed, attempting fallback copy.', error);
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
    logWarn('clipboard', 'Fallback clipboard copy failed.', fallbackError);
    return false;
  }
};

function HomeContent() {
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnline = useNetworkStatus();
  const { canInstall, installed, promptInstall } = usePwaInstallPrompt();
  const {
    member: resolvedMember,
    user,
    error: memberContextError,
    refresh: resolveMemberContext,
    lastSyncedAt: memberLastSyncedAt,
  } = useMemberContext({
    autoResolve: false,
    scope: 'home',
    onUnauthorized: () => router.push('/login'),
  });
  const { t, locale, formatMessage } = useLocale();
  const dateLocale = getDateLocale(locale);
  const translate = useCallback(
    (value: string | null | undefined) => resolveTranslatable(value ?? null, t),
    [t]
  );

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'unauthorized') {
      setError(asTranslationKey('home.unauthorized'));
      const timeout = setTimeout(() => {
        router.replace('/home');
      }, 5000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [router, searchParams]);

  const formatExpiryDate = useCallback(
    (dateStr: string | null) => {
      if (!dateStr) return t('home.expiryUnknown');
      try {
        return new Intl.DateTimeFormat(dateLocale, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(new Date(dateStr));
      } catch (dateError) {
        logError('home', 'Error formatting expiry date.', dateError);
        return t('home.expiryUnknown');
      }
    },
    [dateLocale, t]
  );

  const formatRemainingTime = useCallback(
    (ms: number) => {
      if (ms <= 0) {
        return t('home.tokenExpired');
      }

      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },
    [t]
  );

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
      setPartnersError(null);
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
    if (memberContextError && isOnline) {
      setError((prev) => prev ?? memberContextError);
    }
  }, [isOnline, memberContextError]);

  useEffect(() => {
    if (resolvedMember) {
      setMemberData(resolvedMember);
    }
  }, [resolvedMember]);

  useEffect(() => {
    if (memberLastSyncedAt) {
      setLastSyncedAt(memberLastSyncedAt);
    }
  }, [memberLastSyncedAt]);

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
        logError('home', 'Error loading active token.', error);
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
      logError('home', 'Unexpected error loading active token.', loadError);
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
        const memberResult = await resolveMemberContext();

        if (memberResult.status === 'unauthenticated') {
          setLoading(false);
          setPartnersLoading(false);
          return false;
        }

        if (memberResult.status === 'error' || !memberResult.user || !memberResult.member) {
          const message = memberResult.error ?? asTranslationKey('home.errors.loadMember');
          setError((prev) => prev ?? message);
          return false;
        }

        const currentUser = memberResult.user;
        const hydratedMember = memberResult.member;
        logDebug('home', 'Member context resolved.', {
          userId: currentUser.id,
          origin: hydratedMember.origin,
        });

        setMemberData(hydratedMember);
        setError(null);

        const partnersResponse = await supabase
          .from('partner_offers')
          .select(
            `id, title, description, discount_code, discount_percentage, scope, branch_id, city, active,
             branch:branch_id (id, name, city)`
          )
          .order('title');

        if (partnersResponse.error) {
          logError('home', 'Error fetching partner data', partnersResponse.error);
          setPartners([]);
          setPartnersError(asTranslationKey('home.errors.loadPartners'));
          return false;
        }

        type PartnerRow = PartnerOfferRecord & {
          branch: PartnerOfferRecord['branch'] | PartnerOfferRecord['branch'][] | null;
        };

        const partnerRows = (partnersResponse.data ?? []) as PartnerRow[];
        const normalizedPartners = partnerRows.map((partner) => ({
          ...partner,
          branch: Array.isArray(partner.branch) ? partner.branch[0] ?? null : partner.branch ?? null,
        }));

        setPartners(normalizedPartners);
        setPartnersError(null);

        const activeToken = await loadActiveToken(currentUser.id);
        const diagnostics = diagnosePartnerVisibility(
          hydratedMember.branch_id,
          groupPartnersForMember(normalizedPartners, hydratedMember.branch_id)
        );

        const saved = saveHomeSnapshot({
          member: hydratedMember,
          partners: normalizedPartners,
          token: activeToken,
          partnerDiagnostics: diagnostics,
        });

        setRestoredFromSnapshot(false);
        setSnapshotSavedAt(null);
        setLastSyncedAt(memberResult.lastSyncedAt ?? saved.savedAt);
        return true;
      } catch (fetchError) {
        logError('home', 'Unexpected error loading home screen.', fetchError);
        setError((prev) => prev ?? asTranslationKey('home.errors.loadUnexpected'));
        return false;
      } finally {
        setLoading(false);
        setPartnersLoading(false);
      }
    },
    [
      isOnline,
      loadActiveToken,
      resolveMemberContext,
      restoredFromSnapshot,
    ]
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
        throw new Error(errorPayload.error || asTranslationKey('home.errors.generateFailed'));
      }

      const payload = await response.json();
      const expiresAt = payload?.expiresAt ?? payload?.expires_at;

      if (!payload?.code || !expiresAt) {
        throw new Error(asTranslationKey('home.errors.generateInvalid'));
      }

      setToken({ code: payload.code, expiresAt });
      setTimeLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
      setTokenError(null);
      setPendingTokenRequest(false);
    } catch (generationError) {
      logError('home', 'Error generating token.', generationError);
      setTokenError(
        generationError instanceof Error
          ? generationError.message
          : asTranslationKey('home.errors.generateUnknown')
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
      setTokenError(asTranslationKey('home.errors.clipboard'));
    }
  }, [token]);

  const handleInstallClick = useCallback(async () => {
    setInstallError(null);
    try {
      const result = await promptInstall();
      if (result.outcome === 'unavailable') {
        setInstallError(asTranslationKey('home.install.unavailable'));
      } else if (result.outcome === 'dismissed') {
        setInstallError(asTranslationKey('home.install.dismissed'));
      }
    } catch (installErrorInstance) {
      logError('home', 'Error triggering PWA install.', installErrorInstance);
      setInstallError(asTranslationKey('home.install.failed'));
    }
  }, [promptInstall]);

  const handleProfileUpdated = useCallback(
    (next: MemberData | null) => {
      if (!next) {
        return;
      }
      setMemberData(next);
    },
    []
  );

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
      return new Intl.DateTimeFormat(dateLocale, {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(snapshotSavedAt));
    } catch (formatError) {
      logError('home', 'Error formatting snapshot timestamp.', formatError);
      return snapshotSavedAt;
    }
  }, [dateLocale, snapshotSavedAt]);

  const lastSyncedLabel = useMemo(() => {
    if (!lastSyncedAt) return null;
    try {
      return new Intl.DateTimeFormat(dateLocale, {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(lastSyncedAt));
    } catch (formatError) {
      logError('home', 'Error formatting last synced timestamp.', formatError);
      return lastSyncedAt;
    }
  }, [dateLocale, lastSyncedAt]);

  const lastRefreshAttemptLabel = useMemo(() => {
    if (!lastRefreshAttemptAt) return null;
    try {
      return new Intl.DateTimeFormat(dateLocale, {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(lastRefreshAttemptAt));
    } catch (formatError) {
      logError('home', 'Error formatting refresh attempt timestamp.', formatError);
      return lastRefreshAttemptAt;
    }
  }, [dateLocale, lastRefreshAttemptAt]);

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

  const renderPartnerCard = useCallback(
    (partner: PartnerOfferRecord) => {
      const locationSource = partner.city || partner.branch?.city || partner.branch?.name || null;
      const locationLabel = translate(locationSource) ?? locationSource;
      const hasDiscount =
        typeof partner.discount_percentage === 'number' && !Number.isNaN(partner.discount_percentage);
      const branchLabelSource = partner.scope === 'local' ? partner.branch?.name ?? null : null;
      const branchLabel = translate(branchLabelSource) ?? branchLabelSource;
      const title = translate(partner.title) ?? partner.title;
      const description = translate(partner.description) ?? partner.description;

      return (
        <div
          key={partner.id}
          className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
          style={{ borderColor: '#e0e0e0', backgroundColor: '#f9fafb' }}
        >
          <div>
            <p className="font-medium" style={{ color: '#333333' }}>{title}</p>
            {locationLabel && (
              <p className="mt-1 flex items-center gap-2 text-sm" style={{ color: '#666666' }}>
                <MapPin className="h-4 w-4" />
                {locationLabel}
              </p>
            )}
            {branchLabel && (
              <p className="mt-1 text-xs font-medium uppercase tracking-wide" style={{ color: '#1d4f7d' }}>
                {`${t('home.partners.branchLabel')}: ${branchLabel}`}
              </p>
            )}
            {description && (
              <p className="mt-2 text-sm" style={{ color: '#4b5563' }}>{description}</p>
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
    },
    [t, translate]
  );

  const isApproved = memberData?.approved ?? true;
  const canGenerateToken = Boolean(memberData?.membership_active) && isApproved;
  const branchName = translate(memberData?.branch?.name);
  const branchLocation = translate(memberData?.branch?.location || memberData?.branch?.city);
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
          <p style={{ color: '#666666' }}>{t('home.loading')}</p>
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
            <h2 className="mb-2">{t('home.memberMissing.title')}</h2>
            <p className="mb-6" style={{ color: '#666666' }}>
              {t('home.memberMissing.description')}
            </p>
            <button
              onClick={handleSignOut}
              className="psychocas-button-primary"
              style={{ backgroundColor: '#c62828' }}
            >
              {t('home.memberMissing.signOut')}
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
          <Card
            title={t('home.membership')}
            subtitle={resolveTranslatable(error, t) ?? undefined}
            headerSlot={<Badge tone="danger">{t('home.membershipInactive')}</Badge>}
            padding="sm"
          />
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
                  {t('home.offline.title')}
                </h3>
                <p className="text-sm" style={{ color: '#1d4f7d' }}>
                  {formatMessage('home.offline.description', { label: offlineSnapshotLabel })}
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
                  ? formatMessage('home.refreshStatus.success', { timestamp: lastRefreshAttemptLabel })
                  : formatMessage('home.refreshStatus.error', { timestamp: lastRefreshAttemptLabel })}
              </span>
          </div>
        )}
          <Button
            type="button"
            variant="secondary"
            onClick={handleRefresh}
            disabled={isRefreshing || !isOnline}
          >
            {isRefreshing ? t('home.refreshing') : t('home.refresh')}
          </Button>
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
          <h1 className="mb-2">{t('home.welcome')}!</h1>
          <p style={{ color: '#666666' }}>{memberData.full_name || memberEmail}</p>
        </div>

        <div className="psychocas-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h2 style={{ color: '#333333' }}>{t('home.install.heading')}</h2>
              <p className="text-sm" style={{ color: '#666666' }}>
                {t('home.install.description')}
              </p>
              {!canInstall && !installed && (
                <p className="text-xs" style={{ color: '#1d4f7d' }}>
                  {t('home.install.instructions')}
                </p>
              )}
              {installed && (
                <p className="text-xs" style={{ color: '#047857' }}>
                  {t('home.install.installed')}
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
              {t('home.install.button')}
            </button>
          </div>
          {canInstall && !installed && (
            <p className="mt-3 text-xs" style={{ color: '#666666' }}>
              {t('home.install.confirm')}
            </p>
          )}
          {installError && (
            <p className="mt-3 text-sm" style={{ color: '#b91c1c' }}>{resolveTranslatable(installError, t)}</p>
          )}
        </div>

        {memberData.approved === false && (
          <div className="psychocas-card" style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74' }}>
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 flex-shrink-0" style={{ color: '#c2410c' }} />
              <div className="space-y-1">
                <h3 className="text-base font-semibold" style={{ color: '#c2410c' }}>{t('home.pendingApproval.title')}</h3>
                <p className="text-sm" style={{ color: '#9a3412' }}>
                  {t('home.pendingApproval.description')}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="psychocas-card">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 style={{ color: '#333333' }}>{t('home.membership')}</h2>
              <p className="text-sm" style={{ color: '#666666' }}>{memberEmail}</p>
              {lastSyncedLabel && (
                <p className="text-xs" style={{ color: '#9ca3af' }}>
                  {formatMessage('home.lastSyncedPrefix', { timestamp: lastSyncedLabel })}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <Badge tone={memberData.membership_active ? 'success' : 'warning'}>
                {memberData.membership_active ? t('home.membershipActive') : t('home.membershipInactive')}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setIsProfileOpen(true)}>
                {t('home.manageProfile')}
              </Button>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span style={{ color: '#666666' }}>{t('home.membershipStatus')}</span>
              <span
                className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                  memberData.membership_active ? 'status-active' : 'status-inactive'
                }`}
              >
                {memberData.membership_active
                  ? t('home.membershipStatusBadgeActive')
                  : t('home.membershipStatusBadgeInactive')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: '#666666' }}>{t('home.membershipValidity')}</span>
              <span style={{ color: '#333333', fontWeight: 500 }}>{formatExpiryDate(memberData.membership_expires)}</span>
            </div>
            {branchName && (
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: '#f8fafc' }}>
                <p className="text-xs uppercase tracking-wide" style={{ color: '#1d4f7d', fontWeight: 600 }}>
                  {t('home.membershipLocalBranch')}
                </p>
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
              <h2 style={{ color: '#333333' }}>{t('home.membershipCard.heading')}</h2>
              <p className="text-sm" style={{ color: '#666666' }}>
                {t('home.membershipCard.description')}
              </p>
            </div>
            {token && timeLeft > 0 && (
              <span className="flex items-center gap-1 text-sm font-medium" style={{ color: '#2e7d32' }}>
                <CheckCircle2 className="h-5 w-5" />
                {t('home.membershipCard.statusValid')}
              </span>
            )}
          </div>

          <div className="mt-6 space-y-4">
            {!isOnline && (
              <div
                className="rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: '#f97316', backgroundColor: '#fff7ed', color: '#9a3412' }}
              >
                {t('home.offline.cardHint')}
              </div>
            )}
            {pendingTokenRequest && !isOnline && (
              <p className="text-sm" style={{ color: '#1d4f7d' }}>{t('home.offline.queueMessage')}</p>
            )}
            {token ? (
              <div className="rounded-2xl border px-4 py-5" style={{ borderColor: '#bbdefb', backgroundColor: '#e3f2fd' }}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide" style={{ color: '#1d4f7d', fontWeight: 600 }}>
                      {t('home.membershipCard.hashLabel')}
                    </p>
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
                    {t('home.membershipCard.copy')}
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="rounded-2xl border border-dashed px-4 py-5 text-sm"
                style={{ borderColor: '#cbd5f5', backgroundColor: '#f8fafc', color: '#666666' }}
              >
                {t('home.membershipCard.noToken')}
              </div>
            )}

            {tokenError && (
              <p className="text-sm" style={{ color: '#c62828' }}>{resolveTranslatable(tokenError, t)}</p>
            )}
            {copied && (
              <p className="text-xs" style={{ color: '#2e7d32' }}>{t('home.membershipCard.copied')}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={handleGenerateToken}
                disabled={!canGenerateToken || tokenLoading}
                className="psychocas-button-primary"
              >
                {tokenLoading
                  ? t('home.membershipCard.generateLoading')
                  : token
                    ? t('home.membershipCard.generateRefresh')
                    : t('home.membershipCard.generateCreate')}
              </button>
              <button
                onClick={() => router.push('/redeem')}
                className="psychocas-button-secondary"
              >
                <QrCode className="h-5 w-5" />
                {t('home.membershipCard.showQr')}
              </button>
            </div>

            {!canGenerateToken && (
              <p className="text-sm" style={{ color: '#c62828' }}>
                {memberData.approved === false
                  ? t('home.membershipCard.pendingApproval')
                  : t('home.membershipCard.requireActive')}
              </p>
            )}
          </div>
        </div>

        <div className="psychocas-card">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 style={{ color: '#333333' }}>{t('home.partners.heading')}</h2>
              <p className="text-sm" style={{ color: '#666666' }}>
                {t('home.partners.description')}
              </p>
            </div>
            <MapPin className="h-6 w-6" style={{ color: '#1d4f7d' }} />
          </div>

          {partnersLoading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#1d4f7d' }}></div>
            </div>
          ) : !isApproved ? (
            <p className="text-sm" style={{ color: '#c2410c' }}>{t('home.partners.approvalsPending')}</p>
          ) : (
            <div className="space-y-5">
              {partnerGroups.national.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1d4f7d' }}>
                    {t('home.partners.national')}
                  </h3>
                  {partnerGroups.national.map(renderPartnerCard)}
                </div>
              )}
              {partnerGroups.local.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1d4f7d' }}>
                    {formatMessage('home.partners.local', { location: branchLocation ? ` – ${branchLocation}` : '' })}
                  </h3>
                  {partnerGroups.local.map(renderPartnerCard)}
                </div>
              )}
              {!partnerSectionHasContent && !partnersError && (
                <p className="text-sm" style={{ color: '#666666' }}>{t('home.partners.empty')}</p>
              )}
              {partnersError && (
                <p className="text-sm" style={{ color: '#c62828' }}>{resolveTranslatable(partnersError, t)}</p>
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
                    {t('home.partners.diagnosticsTitle')}{' '}
                    {partnerDiagnostics.hasIssues
                      ? t('home.partners.diagnosticsNeedsAttention')
                      : t('home.partners.diagnosticsOk')}
                  </p>
                  {partnerDiagnostics.hasIssues ? (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs" style={{ color: '#991b1b' }}>
                      {partnerDiagnostics.hiddenEligible.length > 0 && (
                        <li>
                          {formatMessage('home.partners.diagnosticsHiddenEligible', {
                            count: partnerDiagnostics.hiddenEligible.length,
                          })}
                        </li>
                      )}
                      {partnerDiagnostics.extraneousLocal.length > 0 && (
                        <li>
                          {formatMessage('home.partners.diagnosticsExtraneousLocal', {
                            count: partnerDiagnostics.extraneousLocal.length,
                          })}
                        </li>
                      )}
                      {partnerDiagnostics.extraneousNational.length > 0 && (
                        <li>
                          {formatMessage('home.partners.diagnosticsExtraneousNational', {
                            count: partnerDiagnostics.extraneousNational.length,
                          })}
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs" style={{ color: '#047857' }}>{t('home.partners.diagnosticsAllMatched')}</p>
                  )}
                  {partnerGroups.excluded.length > 0 && !partnerDiagnostics.hasIssues && (
                    <p className="mt-2 text-xs" style={{ color: '#4b5563' }}>
                      {formatMessage('home.partners.diagnosticsExcluded', {
                        count: partnerGroups.excluded.length,
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {showManagementShortcuts && (
          <div className="psychocas-card">
            <h2 className="mb-4" style={{ color: '#333333' }}>{t('home.management.heading')}</h2>
            <div className="space-y-3">
              {(memberData.role === 'manager' || memberData.role === 'council') && (
                <>
                  <button
                    onClick={() => router.push('/validate')}
                    className="w-full flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors duration-300 hover:bg-gray-50"
                    style={{ borderColor: '#e0e0e0', color: '#333333' }}
                  >
                    <span>{t('home.management.validate')}</span>
                    <span style={{ color: '#1d4f7d' }}>→</span>
                  </button>
                  <button
                    onClick={() => router.push('/stats')}
                    className="w-full flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors duration-300 hover:bg-gray-50"
                    style={{ borderColor: '#e0e0e0', color: '#333333' }}
                  >
                    <span>{t('home.management.stats')}</span>
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
                  <span>{t('home.management.technician')}</span>
                  <span style={{ color: '#1d4f7d' }}>→</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {memberData && <Navigation userRole={memberData.role} />}
      <ProfileDrawer
        member={memberData}
        open={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onUpdated={handleProfileUpdated}
      />
    </main>
  );
}

function HomeLoadingFallback() {
  const { t } = useLocale();

  return (
    <main className="psychocas-section flex items-center justify-center">
      <div className="text-center fade-in-up">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4"
          style={{ borderColor: '#1d4f7d' }}
        ></div>
        <p style={{ color: '#666666' }}>{t('home.loading')}</p>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<HomeLoadingFallback />}>
      <HomeContent />
    </Suspense>
  );
}
