'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react';
import { useAction, useConvex, useMutation, useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import {
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  FileJson,
  Globe2,
  Home,
  Lightbulb,
  Loader2,
  LogOut,
  MapPin,
  MessageSquareText,
  QrCode,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Store,
  Tags,
  UserRound,
  WifiOff,
} from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import PsychocasLogo from '@/components/PsychocasLogo';
import useNetworkStatus from '@/hooks/useNetworkStatus';
import usePwaInstallPrompt from '@/hooks/usePwaInstallPrompt';
import {
  clearMemberSnapshot,
  loadMemberSnapshot,
  saveMemberSnapshot,
  type MemberOfflineSnapshot,
  type OfflineOffer,
} from '@/lib/pwa/memberSnapshot';
import { colors, radii, shadows, typography } from '@/ui/theme';

type AppTab = 'home' | 'offers' | 'card' | 'profile';
type OfferFilter = 'all' | 'national' | 'local';
type IssuedToken = {
  tokenId: Id<'tokens'>;
  expiresAt: number;
  offer: { id: Id<'offers'>; title: string; value: string };
  partner: { id: Id<'partners'>; name: string };
  secret: string;
  shortCode: string;
  verificationPath: string;
};

const navigation: Array<{ id: AppTab; label: string; Icon: typeof Home }> = [
  { id: 'home', label: 'Domů', Icon: Home },
  { id: 'offers', label: 'Výhody', Icon: Tags },
  { id: 'card', label: 'QR karta', Icon: QrCode },
  { id: 'profile', label: 'Profil', Icon: UserRound },
];

const roleLabels = {
  member: 'Člen',
  manager: 'Manažer',
  board: 'Board',
  admin: 'Admin',
} as const;

const preferenceLabels = {
  membershipReminders: 'Připomenutí členství',
  newOffers: 'Nové výhody',
  events: 'Události Psychočasu',
} as const;

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(timestamp),
  );
}

function vapidKeyToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function userAgentGroup(): string {
  if (/Android/i.test(navigator.userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios';
  return 'desktop';
}

function AppSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`border bg-white ${className}`}
      style={{ borderColor: colors.border, borderRadius: radii.md, boxShadow: shadows.sm }}
    >
      {children}
    </section>
  );
}

function OfferRow({
  offer,
  onSelect,
}: {
  offer: OfflineOffer & { description?: string | null };
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-[76px] w-full items-center gap-3 border-b px-4 py-3 text-left last:border-b-0"
      style={{ borderColor: colors.border, background: colors.background }}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center"
        style={{ borderRadius: radii.md, background: colors.brandSurface, color: colors.brandPrimary }}
      >
        {offer.scope === 'national' ? <Globe2 size={20} /> : <MapPin size={20} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold" style={{ color: colors.textPrimary }}>
          {offer.partnerName}
        </span>
        <span className="mt-0.5 block truncate text-sm" style={{ color: colors.textSecondary }}>
          {offer.title}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span
          className="block px-2 py-1 text-xs font-bold"
          style={{ borderRadius: radii.sm, background: colors.brandPrimary, color: colors.background }}
        >
          {offer.value}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: colors.textSecondary }} />
    </button>
  );
}

function TokenView({ token, onRegenerate }: { token: IssuedToken; onRegenerate: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const verificationUrl = typeof window === 'undefined' ? token.verificationPath : `${window.location.origin}${token.verificationPath}`;
  const seconds = Math.max(0, Math.ceil((token.expiresAt - now) / 1000));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <AppSection className="overflow-hidden">
      <div className="border-b px-4 py-4" style={{ borderColor: colors.border }}>
        <p className="text-xs font-semibold uppercase" style={{ color: colors.brandPrimary }}>
          {token.partner.name}
        </p>
        <h2 className="mt-1 text-lg font-semibold" style={{ color: colors.textPrimary }}>
          {token.offer.title}
        </h2>
        <p className="mt-1 text-2xl font-bold" style={{ color: colors.brandPrimary }}>
          {token.offer.value}
        </p>
      </div>
      <div className="flex flex-col items-center px-5 py-5">
        {seconds > 0 ? (
          <>
            <div className="bg-white p-3" style={{ borderRadius: radii.md }}>
              <QRCode value={verificationUrl} size={210} bgColor="#FFFFFF" fgColor="#172033" />
            </div>
            <p className="mt-4 font-mono text-xl font-semibold tracking-[0.12em]" style={{ color: colors.textPrimary }}>
              {token.shortCode}
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm font-semibold" style={{ color: seconds <= 30 ? colors.dangerStrong : colors.success }}>
              <CalendarDays size={17} />
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </div>
            <p className="mt-3 max-w-xs text-center text-xs leading-5" style={{ color: colors.textSecondary }}>
              Obsluha naskenuje QR běžným fotoaparátem telefonu. Zobrazí se pouze platnost členství a nabídky.
            </p>
          </>
        ) : (
          <div className="py-10 text-center">
            <WifiOff className="mx-auto h-8 w-8" style={{ color: colors.textSecondary }} />
            <p className="mt-3 font-semibold" style={{ color: colors.textPrimary }}>Kód vypršel</p>
            <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>Vytvoř si nový kód pro další ověření.</p>
            <button type="button" onClick={onRegenerate} className="mt-5 min-h-11 px-4 font-semibold text-white" style={{ borderRadius: radii.md, background: colors.brandPrimary }}>
              Vytvořit nový kód
            </button>
          </div>
        )}
      </div>
    </AppSection>
  );
}

export default function ConvexMemberHome() {
  const router = useRouter();
  const convex = useConvex();
  const { signOut } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const viewer = useQuery(api.members.viewer, isAuthenticated ? {} : 'skip');
  const ensureViewer = useMutation(api.members.ensureViewer);
  const ensureIam = useMutation(api.iam.ensureBootstrap);
  const [iamReady, setIamReady] = useState(false);
  const access = useQuery(api.iam.viewerAccess, viewer?.status === 'ready' && iamReady ? {} : 'skip');
  const liveOffers = useQuery(api.offers.listForViewer, viewer?.status === 'ready' && iamReady ? {} : 'skip');
  const currentToken = useQuery(api.qr.current, viewer?.status === 'ready' && iamReady ? {} : 'skip');
  const privacy = useQuery(api.privacy.myOverview, viewer?.status === 'ready' && iamReady ? {} : 'skip');
  const upcomingEvents = useQuery(api.events.listForViewer, viewer?.status === 'ready' && iamReady ? {} : 'skip');
  const notificationConfig = useQuery(api.notifications.configuration, viewer?.status === 'ready' && iamReady ? {} : 'skip');
  const issueToken = useAction(api.qrActions.issue);
  const submitFeedback = useMutation(api.feedback.submit);
  const submitSuggestion = useMutation(api.feedback.submitPartnerSuggestion);
  const updatePreferences = useMutation(api.privacy.updateNotificationPreferences);
  const submitPrivacyRequest = useMutation(api.privacy.submitRequest);
  const subscribePush = useMutation(api.notifications.subscribe);
  const unsubscribePush = useMutation(api.notifications.unsubscribe);
  const { canInstall, installed, promptInstall } = usePwaInstallPrompt();
  const isOnline = useNetworkStatus();
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [offerFilter, setOfferFilter] = useState<OfferFilter>('all');
  const [offerSearch, setOfferSearch] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState<Id<'offers'> | null>(null);
  const [issuedToken, setIssuedToken] = useState<IssuedToken | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [offlineSnapshot, setOfflineSnapshot] = useState<MemberOfflineSnapshot | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [suggestionName, setSuggestionName] = useState('');
  const [privacyType, setPrivacyType] = useState<'access' | 'correction' | 'deletion' | 'restriction' | 'objection'>('access');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushWorking, setPushWorking] = useState(false);
  const syncStartedRef = useRef(false);
  const signOutStartedRef = useRef(false);
  const iamStartedRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/login');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !viewer) return;
    if (viewer.status === 'not_allowed') {
      if (signOutStartedRef.current) return;
      signOutStartedRef.current = true;
      void signOut().finally(() => router.replace('/login?error=unauthorized'));
      return;
    }
    if (viewer.status !== 'needs_sync' || syncStartedRef.current) return;
    syncStartedRef.current = true;
    void ensureViewer()
      .then((result) => {
        if (result.status !== 'ready') return signOut().then(() => router.replace('/login?error=unauthorized'));
      })
      .finally(() => {
        syncStartedRef.current = false;
      });
  }, [ensureViewer, isAuthenticated, router, signOut, viewer]);

  useEffect(() => {
    if (viewer?.status !== 'ready' || iamStartedRef.current) return;
    iamStartedRef.current = true;
    void ensureIam()
      .then(() => setIamReady(true))
      .catch(() => {
        iamStartedRef.current = false;
        setMessage('Organizační data se nepodařilo připravit. Zkus stránku obnovit.');
      });
  }, [ensureIam, viewer]);

  useEffect(() => {
    if (viewer?.status !== 'ready' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    void navigator.serviceWorker
      .getRegistration('/')
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setPushEnabled(Boolean(subscription)))
      .catch(() => setPushEnabled(false));
  }, [viewer]);

  const offers: OfflineOffer[] = useMemo(() => {
    if (liveOffers) {
      return liveOffers.map((offer) => ({
        id: offer.id,
        title: offer.title,
        value: offer.value,
        scope: offer.scope,
        partnerName: offer.partner.name,
        category: offer.partner.category,
        validUntil: offer.validUntil,
      }));
    }
    return offlineSnapshot?.offers ?? [];
  }, [liveOffers, offlineSnapshot]);

  useEffect(() => {
    if (isOnline || liveOffers) return;
    void loadMemberSnapshot().then(setOfflineSnapshot).catch(() => setOfflineSnapshot(null));
  }, [isOnline, liveOffers]);

  useEffect(() => {
    if (!isOnline || viewer?.status !== 'ready' || !liveOffers) return;
    const snapshotOffers = liveOffers.map((offer) => ({
      id: offer.id,
      title: offer.title,
      value: offer.value,
      scope: offer.scope,
      partnerName: offer.partner.name,
      category: offer.partner.category,
      validUntil: offer.validUntil,
    }));
    void saveMemberSnapshot({
      membershipUntil: viewer.member.membershipUntil,
      branchName: viewer.member.branch?.name ?? null,
      offers: snapshotOffers,
    }).then(setOfflineSnapshot).catch(() => undefined);
  }, [isOnline, liveOffers, viewer]);

  useEffect(() => {
    if (!selectedOfferId && offers.length > 0) setSelectedOfferId(offers[0].id as Id<'offers'>);
  }, [offers, selectedOfferId]);

  const filteredOffers = useMemo(() => {
    const search = offerSearch.trim().toLocaleLowerCase('cs');
    return offers.filter((offer) => {
      if (offerFilter !== 'all' && offer.scope !== offerFilter) return false;
      if (!search) return true;
      return `${offer.partnerName} ${offer.title} ${offer.value}`.toLocaleLowerCase('cs').includes(search);
    });
  }, [offerFilter, offerSearch, offers]);

  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) ?? null;
  const canOpenWorkspace = Boolean(
    access?.capabilities.some((capability) =>
      [
        'support.read',
        'membership.read',
        'partner.draft',
        'offer.draft',
        'offer.publish',
        'campaign.draft',
        'campaign.send',
        'event.manage',
        'event.check_in',
        'metrics.read',
        'privacy.manage',
      ].includes(capability),
    ),
  );
  const canOpenAdmin = access?.capabilities.includes('membership.manage') ?? false;

  const handleIssueToken = async () => {
    if (!selectedOfferId || !isOnline || issuing) return;
    setIssuing(true);
    setMessage(null);
    try {
      const result = await issueToken({ offerId: selectedOfferId });
      setIssuedToken(result as IssuedToken);
    } catch {
      setMessage('QR kód se nepodařilo vytvořit. Ověř připojení a platnost nabídky.');
    } finally {
      setIssuing(false);
    }
  };

  const handleSignOut = async () => {
    await clearMemberSnapshot().catch(() => undefined);
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_PRIVATE_CACHES' });
    await signOut();
    router.replace('/login');
  };

  const handlePushToggle = async () => {
    if (pushWorking || !notificationConfig?.pushConfigured || !notificationConfig.publicKey) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setMessage('Tento prohlížeč push oznámení nepodporuje.');
      return;
    }
    setPushWorking(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await unsubscribePush({ endpoint: existing.endpoint });
        await existing.unsubscribe();
        setPushEnabled(false);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('permission_denied');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyToBytes(notificationConfig.publicKey),
      });
      const serialized = subscription.toJSON();
      if (!serialized.keys?.p256dh || !serialized.keys.auth) throw new Error('missing_push_keys');
      await subscribePush({
        endpoint: subscription.endpoint,
        p256dh: serialized.keys.p256dh,
        auth: serialized.keys.auth,
        userAgentGroup: userAgentGroup(),
      });
      setPushEnabled(true);
    } catch {
      setMessage('Push oznámení se nepodařilo nastavit. Zkontroluj oprávnění prohlížeče.');
    } finally {
      setPushWorking(false);
    }
  };

  const handlePrivacyExport = async () => {
    setMessage(null);
    try {
      const data = await convex.query(api.privacy.exportMyData, {});
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `psychocas-osobni-udaje-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage('Export osobních údajů se nepodařilo připravit.');
    }
  };

  if (authLoading || !viewer || viewer.status !== 'ready' || !iamReady) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5" style={{ background: colors.backgroundMuted }}>
        <div className="flex items-center gap-3 text-sm" role="status" style={{ color: colors.textSecondary }}>
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: colors.brandPrimary }} />
          Načítám členskou aplikaci…
        </div>
      </main>
    );
  }

  const member = viewer.member;

  return (
    <main className="min-h-screen pb-24" style={{ background: colors.backgroundMuted, color: colors.textPrimary }}>
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur" style={{ borderColor: colors.border }}>
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <button type="button" onClick={() => setActiveTab('home')} className="flex min-w-0 items-center gap-2 text-left" aria-label="Domů">
            <PsychocasLogo size={38} />
            <span className="min-w-0">
              <span className="block text-sm font-bold" style={{ color: colors.brandPrimary }}>Psychočas</span>
              <span className="block truncate text-xs" style={{ color: colors.textSecondary }}>{member.branch?.name ?? 'Členská aplikace'}</span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="flex h-9 items-center gap-1.5 px-2 text-xs font-semibold" style={{ borderRadius: radii.sm, background: colors.warningSurface, color: '#92400e' }}>
                <WifiOff size={15} /> Offline
              </span>
            )}
            <button type="button" onClick={() => setActiveTab('profile')} className="flex h-10 w-10 items-center justify-center border" aria-label="Otevřít profil" style={{ borderColor: colors.border, borderRadius: radii.md, background: colors.background }}>
              <UserRound size={19} style={{ color: colors.brandPrimary }} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-7">
        {message && (
          <div className="mb-4 border px-4 py-3 text-sm" role="alert" style={{ borderColor: '#FECACA', borderRadius: radii.md, background: colors.dangerSurface, color: colors.dangerStrong }}>
            {message}
          </div>
        )}

        {activeTab === 'home' && (
          <div className="space-y-5">
            <section>
              <p className="text-sm font-medium" style={{ color: colors.textSecondary }}>Ahoj,</p>
              <h1 className="mt-1 text-2xl font-semibold" style={{ color: colors.textPrimary, fontFamily: typography.heading }}>{member.fullName}</h1>
            </section>

            <AppSection className="overflow-hidden">
              <div className="flex items-start justify-between gap-4 px-5 py-5" style={{ background: colors.brandPrimary, color: colors.background }}>
                <div>
                  <p className="text-xs font-semibold uppercase opacity-80">Digitální členství</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">Aktivní do {formatDate(member.membershipUntil)}</h2>
                  <p className="mt-1 text-sm text-white/80">{member.branch?.name ?? 'Celostátní členství'}</p>
                </div>
                <CheckCircle2 className="h-7 w-7 shrink-0" />
              </div>
              <div className="grid grid-cols-2 divide-x border-t" style={{ borderColor: colors.border }}>
                <div className="px-4 py-3">
                  <p className="text-xs" style={{ color: colors.textSecondary }}>Role</p>
                  <p className="mt-1 text-sm font-semibold">{roleLabels[member.role]}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs" style={{ color: colors.textSecondary }}>Výhody</p>
                  <p className="mt-1 text-sm font-semibold">{offers.length} dostupných</p>
                </div>
              </div>
            </AppSection>

            <button type="button" onClick={() => setActiveTab('offers')} className="flex min-h-12 w-full items-center justify-center gap-2 px-4 font-semibold text-white" style={{ borderRadius: radii.md, background: colors.brandPrimary }}>
              <Tags size={20} /> Vybrat členskou výhodu
            </button>

            <section>
              <div className="mb-2 flex items-end justify-between gap-3 px-1">
                <div>
                  <h2 className="text-base font-semibold" style={{ color: colors.textPrimary }}>Aktuální výhody</h2>
                  <p className="text-xs" style={{ color: colors.textSecondary }}>{isOnline ? 'Podle tvého členství a pobočky' : `Uloženo ${offlineSnapshot ? new Date(offlineSnapshot.savedAt).toLocaleString('cs-CZ') : ''}`}</p>
                </div>
                <button type="button" onClick={() => setActiveTab('offers')} className="text-sm font-semibold" style={{ color: colors.brandPrimary }}>Všechny</button>
              </div>
              <AppSection className="overflow-hidden">
                {offers.slice(0, 3).map((offer) => (
                  <OfferRow key={offer.id} offer={offer} onSelect={() => { setSelectedOfferId(offer.id as Id<'offers'>); setActiveTab('card'); }} />
                ))}
                {offers.length === 0 && <p className="px-5 py-8 text-center text-sm" style={{ color: colors.textSecondary }}>Zatím nejsou publikované žádné výhody.</p>}
              </AppSection>
            </section>

            {(upcomingEvents?.length ?? 0) > 0 && (
              <section>
                <div className="mb-2 px-1"><h2 className="text-base font-semibold" style={{ color: colors.textPrimary }}>Nadcházející události</h2><p className="text-xs" style={{ color: colors.textSecondary }}>Akce dostupné pro tvoje členství</p></div>
                <AppSection className="divide-y overflow-hidden">
                  {upcomingEvents?.slice(0, 3).map((event) => <article key={event.id} className="flex gap-3 px-4 py-4"><span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center" style={{ borderRadius: radii.md, background: colors.brandSurface, color: colors.brandPrimary }}><strong className="text-base leading-none">{new Date(event.startsAt).getDate()}</strong><span className="mt-1 text-[10px] font-semibold uppercase">{new Intl.DateTimeFormat('cs-CZ', { month: 'short' }).format(new Date(event.startsAt))}</span></span><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{event.title}</h3><p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>{new Date(event.startsAt).toLocaleString('cs-CZ')}{event.location ? ` · ${event.location}` : ''}</p></div></article>)}
                </AppSection>
              </section>
            )}

            {(canOpenWorkspace || canOpenAdmin) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {canOpenWorkspace && (
                  <button type="button" onClick={() => router.push('/workspace')} className="flex min-h-12 items-center justify-between border bg-white px-4 font-semibold" style={{ borderColor: colors.border, borderRadius: radii.md }}>
                    <span className="flex items-center gap-2"><Store size={19} style={{ color: colors.brandPrimary }} /> Pracovní prostor</span><ChevronRight size={18} />
                  </button>
                )}
                {canOpenAdmin && (
                  <button type="button" onClick={() => router.push('/admin')} className="flex min-h-12 items-center justify-between border bg-white px-4 font-semibold" style={{ borderColor: colors.border, borderRadius: radii.md }}>
                    <span className="flex items-center gap-2"><Settings2 size={19} style={{ color: colors.brandPrimary }} /> Členové a přístupy</span><ChevronRight size={18} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'offers' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: colors.textPrimary }}>Členské výhody</h1>
              <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>Národní nabídky a lokální partneři pro tvoji pobočku.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: colors.textSecondary }} />
              <input value={offerSearch} onChange={(event) => setOfferSearch(event.target.value)} placeholder="Hledat partnera nebo výhodu" className="min-h-12 w-full border bg-white pl-10 pr-3 text-base" style={{ borderColor: colors.border, borderRadius: radii.md }} />
            </div>
            <div className="grid grid-cols-3 gap-1 border bg-white p-1" style={{ borderColor: colors.border, borderRadius: radii.md }}>
              {(['all', 'national', 'local'] as OfferFilter[]).map((filter) => (
                <button key={filter} type="button" onClick={() => setOfferFilter(filter)} className="min-h-10 text-sm font-semibold" style={{ borderRadius: radii.sm, background: offerFilter === filter ? colors.brandPrimary : colors.background, color: offerFilter === filter ? colors.background : colors.textSecondary }}>
                  {filter === 'all' ? 'Vše' : filter === 'national' ? 'Národní' : 'Lokální'}
                </button>
              ))}
            </div>
            <AppSection className="overflow-hidden">
              {filteredOffers.map((offer) => <OfferRow key={offer.id} offer={offer} onSelect={() => { setSelectedOfferId(offer.id as Id<'offers'>); setActiveTab('card'); }} />)}
              {filteredOffers.length === 0 && <p className="px-5 py-10 text-center text-sm" style={{ color: colors.textSecondary }}>Žádná výhoda neodpovídá výběru.</p>}
            </AppSection>
          </div>
        )}

        {activeTab === 'card' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: colors.textPrimary }}>QR karta</h1>
              <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>Jednorázové bezpečné ověření konkrétní výhody.</p>
            </div>
            {offers.length > 0 ? (
              <>
                <label className="block text-sm font-medium" style={{ color: colors.textPrimary }}>
                  Vybraná výhoda
                  <select value={selectedOfferId ?? ''} onChange={(event) => { setSelectedOfferId(event.target.value as Id<'offers'>); setIssuedToken(null); }} className="mt-2 min-h-12 w-full border bg-white px-3 text-base" style={{ borderColor: colors.border, borderRadius: radii.md }}>
                    {offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.partnerName} - {offer.value}</option>)}
                  </select>
                </label>
                {issuedToken ? <TokenView token={issuedToken} onRegenerate={() => { setIssuedToken(null); window.setTimeout(() => void handleIssueToken(), 0); }} /> : (
                  <AppSection className="px-5 py-8 text-center">
                    <QrCode className="mx-auto h-10 w-10" style={{ color: colors.brandPrimary }} />
                    <h2 className="mt-3 text-lg font-semibold" style={{ color: colors.textPrimary }}>{selectedOffer?.title}</h2>
                    <p className="mt-1 text-2xl font-bold" style={{ color: colors.brandPrimary }}>{selectedOffer?.value}</p>
                    {currentToken && <p className="mt-3 text-xs" style={{ color: colors.textSecondary }}>Předchozí kód je aktivní na jiném zobrazení. Nový kód ho bezpečně nahradí.</p>}
                    <button type="button" onClick={() => void handleIssueToken()} disabled={!isOnline || issuing} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 px-4 font-semibold text-white" style={{ borderRadius: radii.md, background: !isOnline || issuing ? colors.textSecondary : colors.brandPrimary }}>
                      {issuing ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode size={20} />} {isOnline ? 'Vytvořit QR kód' : 'QR vyžaduje připojení'}
                    </button>
                  </AppSection>
                )}
              </>
            ) : (
              <AppSection className="px-5 py-10 text-center"><Tags className="mx-auto h-9 w-9" style={{ color: colors.textSecondary }} /><p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>Nejdřív musí být publikovaná alespoň jedna nabídka.</p></AppSection>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: colors.textPrimary }}>Profil a soukromí</h1>
              <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>Členství, preference a kontakt s Psychočasem.</p>
            </div>
            <AppSection className="divide-y px-4">
              <div className="flex items-center gap-3 py-4"><UserRound size={19} style={{ color: colors.brandPrimary }} /><div className="min-w-0"><p className="truncate text-sm font-semibold">{member.fullName}</p><p className="truncate text-xs" style={{ color: colors.textSecondary }}>{member.email}</p></div></div>
              <div className="flex items-center gap-3 py-4"><Building2 size={19} style={{ color: colors.brandPrimary }} /><p className="text-sm">{member.branch?.name ?? 'Bez pobočky'}</p></div>
              <div className="flex items-center gap-3 py-4"><CalendarDays size={19} style={{ color: colors.brandPrimary }} /><p className="text-sm">Platnost do {formatDate(member.membershipUntil)}</p></div>
            </AppSection>

            <AppSection className="px-4 py-4">
              <div className="mb-3 flex items-center gap-2"><Bell size={19} style={{ color: colors.brandPrimary }} /><h2 className="text-base font-semibold">Preference oznámení</h2></div>
              <div className="space-y-2">
                {(Object.keys(preferenceLabels) as Array<keyof typeof preferenceLabels>).map((key) => {
                  const checked = privacy?.preferences[key] ?? false;
                  return <label key={key} className="flex min-h-11 items-center justify-between gap-3 border-t first:border-t-0" style={{ borderColor: colors.border }}><span className="text-sm">{preferenceLabels[key]}</span><input type="checkbox" checked={checked} onChange={(event) => void updatePreferences({ ...(privacy?.preferences ?? { membershipReminders: false, newOffers: false, events: false }), [key]: event.target.checked })} className="h-5 w-5" /></label>;
                })}
              </div>
              <button type="button" disabled={pushWorking || !notificationConfig?.pushConfigured} onClick={() => void handlePushToggle()} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 border font-semibold" style={{ borderColor: colors.brandPrimary, borderRadius: radii.md, color: notificationConfig?.pushConfigured ? colors.brandPrimary : colors.textSecondary }}>
                {pushWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell size={18} />} {notificationConfig?.pushConfigured ? (pushEnabled ? 'Vypnout push na tomto zařízení' : 'Zapnout push na tomto zařízení') : 'Push bude dostupný po nasazení'}
              </button>
            </AppSection>

            <AppSection className="px-4 py-4">
              <div className="mb-3 flex items-center gap-2"><ShieldCheck size={19} style={{ color: colors.brandPrimary }} /><h2 className="text-base font-semibold">Ochrana osobních údajů</h2></div>
              <p className="text-sm leading-6" style={{ color: colors.textSecondary }}>Veřejné QR neukazuje jméno ani email. Metriky jsou dostupné pouze agregovaně.</p>
              <button type="button" onClick={() => void handlePrivacyExport()} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 border font-semibold" style={{ borderColor: colors.border, borderRadius: radii.md, color: colors.brandPrimary }}><FileJson size={18} /> Exportovat moje údaje</button>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <select value={privacyType} onChange={(event) => setPrivacyType(event.target.value as typeof privacyType)} className="min-h-11 border bg-white px-3 text-base" style={{ borderColor: colors.border, borderRadius: radii.md }}><option value="access">Přístup k údajům</option><option value="correction">Oprava údajů</option><option value="deletion">Žádost o výmaz</option><option value="restriction">Omezení zpracování</option><option value="objection">Námitka</option></select>
                <button type="button" onClick={() => void submitPrivacyRequest({ type: privacyType }).then(() => setMessage(null)).catch(() => setMessage('Žádost už je otevřená nebo ji nyní nelze odeslat.'))} className="min-h-11 px-4 font-semibold text-white" style={{ borderRadius: radii.md, background: colors.brandPrimary }}>Odeslat žádost</button>
              </div>
              {(privacy?.requests.length ?? 0) > 0 && <p className="mt-3 text-xs" style={{ color: colors.textSecondary }}>Poslední žádost: {privacy?.requests[0].status}</p>}
            </AppSection>

            <AppSection className="px-4 py-4">
              <div className="mb-3 flex items-center gap-2"><MessageSquareText size={19} style={{ color: colors.brandPrimary }} /><h2 className="text-base font-semibold">Zpětná vazba</h2></div>
              <textarea value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} rows={3} maxLength={2000} placeholder="Co by ti v aplikaci pomohlo? Nevkládej citlivé osobní údaje." className="w-full resize-y border p-3 text-base" style={{ borderColor: colors.border, borderRadius: radii.md }} />
              <button type="button" disabled={feedbackText.trim().length < 10} onClick={() => void submitFeedback({ category: 'app', message: feedbackText }).then(() => { setFeedbackText(''); setMessage(null); }).catch(() => setMessage('Feedback se nepodařilo odeslat.'))} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 font-semibold text-white" style={{ borderRadius: radii.md, background: feedbackText.trim().length < 10 ? colors.textSecondary : colors.brandPrimary }}><Send size={18} /> Odeslat feedback</button>
            </AppSection>

            <AppSection className="px-4 py-4">
              <div className="mb-3 flex items-center gap-2"><Lightbulb size={19} style={{ color: colors.brandPrimary }} /><h2 className="text-base font-semibold">Navrhnout partnera</h2></div>
              <input value={suggestionName} onChange={(event) => setSuggestionName(event.target.value)} placeholder="Název podniku nebo organizace" className="min-h-11 w-full border px-3 text-base" style={{ borderColor: colors.border, borderRadius: radii.md }} />
              <button type="button" disabled={suggestionName.trim().length < 2} onClick={() => void submitSuggestion({ partnerName: suggestionName, branchId: member.branchId ?? undefined }).then(() => { setSuggestionName(''); setMessage(null); }).catch(() => setMessage('Návrh se nepodařilo odeslat.'))} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 border font-semibold" style={{ borderColor: colors.brandPrimary, borderRadius: radii.md, color: colors.brandPrimary }}><Store size={18} /> Odeslat návrh</button>
            </AppSection>

            {canInstall && !installed && <button type="button" onClick={() => void promptInstall()} className="flex min-h-12 w-full items-center justify-center gap-2 border bg-white font-semibold" style={{ borderColor: colors.border, borderRadius: radii.md, color: colors.brandPrimary }}><Download size={19} /> Přidat Psychočas na plochu</button>}
            <a href="/privacy" className="flex min-h-11 items-center justify-center gap-2 text-sm font-semibold" style={{ color: colors.brandPrimary }}><ExternalLink size={16} /> Informace o zpracování údajů</a>
            <button type="button" onClick={() => void handleSignOut()} className="flex min-h-12 w-full items-center justify-center gap-2 border bg-white font-semibold" style={{ borderColor: colors.border, borderRadius: radii.md, color: colors.dangerStrong }}><LogOut size={19} /> Odhlásit se</button>
          </div>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white" style={{ borderColor: colors.border, paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Hlavní navigace">
        <div className="mx-auto grid h-16 max-w-md grid-cols-4">
          {navigation.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return <button key={id} type="button" onClick={() => setActiveTab(id)} className="flex min-w-0 flex-col items-center justify-center gap-1 text-xs font-semibold" aria-current={active ? 'page' : undefined} style={{ color: active ? colors.brandPrimary : colors.textSecondary }}><Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} /><span className="truncate">{label}</span></button>;
          })}
        </div>
      </nav>
    </main>
  );
}
