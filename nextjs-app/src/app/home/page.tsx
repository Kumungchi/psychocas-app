'use client';

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Navigation from '@/components/Navigation';
import type { User } from '@supabase/supabase-js';
import { CheckCircle2, Clock, Copy, MapPin, QrCode, ShieldAlert } from 'lucide-react';

type MemberRole = 'member' | 'manager' | 'council' | 'technician';

interface BranchInfo {
  id: string;
  name: string;
  location?: string | null;
  city?: string | null;
  discount_percentage?: number | null;
  active?: boolean | null;
}

interface MemberData {
  membership_active: boolean;
  membership_expires: string | null;
  full_name: string | null;
  role: MemberRole;
  branch_id: string | null;
  email?: string | null;
  approved?: boolean | null;
  approved_at?: string | null;
  branch?: BranchInfo | null;
}

type PartnerScope = 'national' | 'local';

interface PartnerBranchInfo {
  id: string;
  name: string;
  city?: string | null;
}

interface Partner {
  id: string;
  title: string;
  description?: string | null;
  discount_code?: string | null;
  discount_percentage?: number | null;
  scope: PartnerScope;
  branch_id?: string | null;
  city?: string | null;
  active?: boolean | null;
  branch?: PartnerBranchInfo | null;
}

interface TokenData {
  code: string;
  expiresAt: string;
}

const ROLE_LABELS: Record<MemberRole, string> = {
  member: 'Člen',
  manager: 'Manažer',
  council: 'Rada',
  technician: 'Technik',
};

function HomeContent() {
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(true);
  const [partnersError, setPartnersError] = useState<string | null>(null);
  const [token, setToken] = useState<TokenData | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const loadActiveToken = useCallback(async (userId: string) => {
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
        return;
      }

      if (data && data.length > 0) {
        setToken({
          code: data[0].code,
          expiresAt: data[0].expires_at,
        });
        setTokenError(null);
      } else {
        setToken(null);
        setTimeLeft(0);
      }
    } catch (loadError) {
      console.error('Unexpected error loading active token:', loadError);
    }
  }, []);

  const fetchMemberContext = useCallback(async () => {
    setLoading(true);
    setPartnersLoading(true);
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        setLoading(false);
        setPartnersLoading(false);
        router.push('/login');
        return;
      }

      setUser(currentUser);

      const memberPromise = supabase
        .from('members')
        .select(`
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
        `)
        .eq('user_id', currentUser.id)
        .limit(1);

      const partnersPromise = supabase
        .from('partner_offers')
        .select(
          `id, title, description, discount_code, discount_percentage, scope, branch_id, city, active,
           branch:branch_id (id, name, city)`
        )
        .order('title');

      const [memberResponse, partnersResponse] = await Promise.all([memberPromise, partnersPromise]);

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

          setMemberData({
            membership_active: memberRow.membership_active,
            membership_expires: memberRow.membership_expires,
            full_name: memberRow.full_name,
            role: (memberRow.role ?? 'member') as MemberRole,
            branch_id: memberRow.branch_id,
            email: memberRow.email ?? null,
            approved: memberRow.approved ?? null,
            approved_at: memberRow.approved_at ?? null,
            branch: normalizedBranch,
          });
        } else {
          setMemberData(null);
        }
      }

      if (partnersResponse.error) {
        console.error('Error fetching partner data:', partnersResponse.error);
        setPartners([]);
        setPartnersError('Nepodařilo se načíst partnerské podniky.');
      } else {
        type PartnerRow = Omit<Partner, 'branch'> & {
          branch: PartnerBranchInfo | PartnerBranchInfo[] | null;
        };

        const partnerRows = (partnersResponse.data ?? []) as PartnerRow[];
        const normalizedPartners: Partner[] = partnerRows.map((partner) => ({
          ...partner,
          branch: Array.isArray(partner.branch)
            ? partner.branch[0] ?? null
            : partner.branch ?? null,
        }));

        setPartners(normalizedPartners);
        setPartnersError(null);
      }

      await loadActiveToken(currentUser.id);
    } catch (fetchError) {
      console.error('Unexpected error loading home screen:', fetchError);
      setError((prev) => prev ?? 'Došlo k neočekávané chybě při načítání údajů.');
    } finally {
      setLoading(false);
      setPartnersLoading(false);
    }
  }, [loadActiveToken, router]);

  useEffect(() => {
    fetchMemberContext();
  }, [fetchMemberContext]);

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
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleGenerateToken = useCallback(async () => {
    if (!memberData || !memberData.membership_active || !(memberData.approved ?? true)) {
      return;
    }

    setTokenLoading(true);
    setTokenError(null);

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
  }, [memberData, router]);

  const handleCopyCode = useCallback(async () => {
    if (!token) return;

    try {
      await navigator.clipboard.writeText(token.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      console.error('Failed to copy code:', copyError);
      setTokenError('Nepodařilo se zkopírovat kód do schránky.');
    }
  }, [token]);

  const partnerGroups = useMemo(() => {
    if (!partners.length) {
      return { national: [] as Partner[], local: [] as Partner[], other: [] as Partner[] };
    }

    const activePartners = partners.filter((partner) => partner.active ?? true);
    const memberBranchId = memberData?.branch_id ?? null;

    const national: Partner[] = [];
    const local: Partner[] = [];
    const other: Partner[] = [];

    activePartners.forEach((partner) => {
      if (partner.scope === 'national') {
        national.push(partner);
        return;
      }

      if (partner.scope === 'local' && partner.branch_id && memberBranchId && partner.branch_id === memberBranchId) {
        local.push(partner);
        return;
      }

      other.push(partner);
    });

    return { national, local, other };
  }, [partners, memberData]);

  const renderPartnerCard = useCallback((partner: Partner) => {
    const locationLabel = partner.city || partner.branch?.city || partner.branch?.name || null;
    const hasDiscount = typeof partner.discount_percentage === 'number' && !Number.isNaN(partner.discount_percentage);

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
  const partnerSectionHasContent =
    partnerGroups.national.length > 0 || partnerGroups.local.length > 0 || partnerGroups.other.length > 0;
  const showManagementShortcuts = memberData ? ['manager', 'council', 'technician'].includes(memberData.role) : false;

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
              {partnerGroups.other.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1d4f7d' }}>Další výhody</h3>
                  {partnerGroups.other.map(renderPartnerCard)}
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
