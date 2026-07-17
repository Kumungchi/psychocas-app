'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import QRCode from 'react-qr-code';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Flag,
  Globe2,
  Heart,
  Loader2,
  MapPin,
  QrCode,
  ShieldCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import useLocale from '@/hooks/useLocale';
import type { Locale } from '@/lib/i18n/config';
import { getDateLocale } from '@/lib/i18n/utils';
import type { OfflineOffer } from '@/lib/pwa/memberSnapshot';
import { resolveMemberTokenUiState } from '@/lib/qr/memberTokenState';
import { colors, radii, shadows } from '@/ui/theme';

export type IssuedToken = {
  tokenId: Id<'tokens'>;
  expiresAt: number;
  offer: { id: Id<'offers'>; title: string; value: string };
  partner: { id: Id<'partners'>; name: string };
  secret: string;
  shortCode: string;
  verificationPath: string;
};

export type IssueReason = 'unavailable' | 'terms_mismatch' | 'staff_unaware' | 'wrong_info' | 'other';
type RedemptionExperience = 'accepted' | 'not_accepted' | 'problem';

const categoryLabels: Record<string, string> = {
  cafe: 'Kavárny a občerstvení',
  shop: 'Obchody',
  publisher: 'Knihy a vzdělávání',
  practice: 'Praxe a profesní rozvoj',
  event: 'Události',
  service: 'Služby',
  other: 'Ostatní',
};

const issueReasonLabels: Record<IssueReason, string> = {
  unavailable: 'Nabídka už není dostupná',
  terms_mismatch: 'Podmínky na místě nesouhlasí',
  staff_unaware: 'Obsluha o nabídce nevěděla',
  wrong_info: 'Údaje v aplikaci jsou chybné',
  other: 'Jiný problém',
};

function formatDate(timestamp: number, locale: Locale): string {
  return new Intl.DateTimeFormat(getDateLocale(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function OfferPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`border bg-white ${className}`}
      style={{ borderColor: colors.border, borderRadius: radii.md, boxShadow: shadows.sm }}
    >
      {children}
    </section>
  );
}

export function OfferRow({
  offer,
  onSelect,
  onFavorite,
  favoriteWorking,
  isOnline,
}: {
  offer: OfflineOffer;
  onSelect: () => void;
  onFavorite: () => void;
  favoriteWorking: boolean;
  isOnline: boolean;
}) {
  const { tr } = useLocale();
  return (
    <article className="flex min-h-[82px] items-stretch border-b last:border-b-0" style={{ borderColor: colors.border }}>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center" style={{ borderRadius: radii.md, background: colors.brandSurface, color: colors.brandPrimary }}>
          {offer.scope === 'national' ? <Globe2 size={20} /> : <MapPin size={20} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold" style={{ color: colors.textPrimary }}>{offer.partnerName}</span>
          <span className="mt-0.5 block line-clamp-2 text-sm leading-5" style={{ color: colors.textSecondary }}>{offer.title}</span>
        </span>
        <span className="shrink-0 px-2 py-1 text-xs font-bold text-white" style={{ borderRadius: radii.sm, background: colors.brandPrimary }}>{offer.value}</span>
        <ChevronRight className="h-4 w-4 shrink-0" style={{ color: colors.textSecondary }} />
      </button>
      <button
        type="button"
        onClick={onFavorite}
        disabled={!isOnline || favoriteWorking}
        className="flex w-12 shrink-0 items-center justify-center border-l"
        style={{ borderColor: colors.border, color: offer.favorite ? colors.dangerStrong : colors.textSecondary }}
        aria-label={tr(offer.favorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených')}
        title={tr(offer.favorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených')}
        aria-pressed={offer.favorite}
      >
        {favoriteWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart size={19} fill={offer.favorite ? 'currentColor' : 'none'} />}
      </button>
    </article>
  );
}

export function OfferDetail({
  offer,
  isOnline,
  issuing,
  hasActiveToken,
  startReportOpen,
  onRedeem,
  onChangeOffer,
}: {
  offer: OfflineOffer;
  isOnline: boolean;
  issuing: boolean;
  hasActiveToken: boolean;
  startReportOpen?: boolean;
  onRedeem: () => void;
  onChangeOffer: () => void;
}) {
  const { locale, tr } = useLocale();
  const submitIssue = useMutation(api.offerEngagement.submitIssueReport);
  const [reportOpen, setReportOpen] = useState(Boolean(startReportOpen));
  const [reason, setReason] = useState<IssueReason>('unavailable');
  const [note, setNote] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportNotice, setReportNotice] = useState<'success' | 'error' | null>(null);
  const website = safeExternalUrl(offer.partnerWebsite);
  const mapUrl = offer.partnerAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(offer.partnerAddress)}`
    : null;
  const freshnessDate = offer.lastVerifiedAt ?? offer.updatedAt;

  const handleReport = async () => {
    if (reporting || !isOnline) return;
    setReporting(true);
    setReportNotice(null);
    try {
      await submitIssue({ offerId: offer.id as Id<'offers'>, reason, note: note.trim() || undefined });
      setNote('');
      setReportNotice('success');
    } catch {
      setReportNotice('error');
    } finally {
      setReporting(false);
    }
  };

  return (
    <OfferPanel className="overflow-hidden">
      <div className="border-b px-5 py-5" style={{ borderColor: colors.border, background: colors.brandSurface }}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold" style={{ color: colors.brandOnSurface }}>
          <span className="flex items-center gap-1.5">{offer.scope === 'national' ? <Globe2 size={15} /> : <MapPin size={15} />}{tr(offer.scope === 'national' ? 'Celostátní výhoda' : 'Výhoda pro tvoji pobočku')}</span>
          <span aria-hidden="true">·</span>
          <span>{tr(categoryLabels[offer.category] ?? 'Ostatní')}</span>
        </div>
        <p className="mt-4 text-sm font-semibold" style={{ color: colors.brandPrimary }}>{offer.partnerName}</p>
        <h2 className="mt-1 text-xl font-semibold leading-7" style={{ color: colors.textPrimary }}>{offer.title}</h2>
        <p className="mt-3 text-3xl font-bold" style={{ color: colors.brandPrimary }}>{offer.value}</p>
      </div>

      <div className="space-y-5 px-5 py-5">
        {offer.description && <section><h3 className="text-sm font-semibold">{tr('O nabídce')}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6" style={{ color: colors.textSecondary }}>{offer.description}</p></section>}

        <section className="border-y py-4" style={{ borderColor: colors.border }}>
          <div className="flex items-start gap-3">
            <QrCode className="mt-0.5 h-5 w-5 shrink-0" style={{ color: colors.brandPrimary }} />
            <div><h3 className="text-sm font-semibold">{tr('Jak výhodu uplatnit')}</h3><p className="mt-1 text-sm leading-6" style={{ color: colors.textSecondary }}>{offer.redemptionInstructions || tr('Před placením vytvoř QR kód a nech ho obsluhu jednou naskenovat.')}</p></div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold">{tr('Podmínky nabídky')}</h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-6" style={{ color: colors.textSecondary }}>{offer.terms || tr('Partner neuvedl další omezení. Při nejasnostech se zeptej před objednáním.')}</p>
        </section>

        {(offer.validFrom || offer.validUntil) && <div className="grid gap-3 border-y py-4 text-sm sm:grid-cols-2" style={{ borderColor: colors.border }}>
          {offer.validFrom && <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" style={{ color: colors.brandPrimary }} /><div><p className="text-xs" style={{ color: colors.textSecondary }}>{tr('Platí od')}</p><p className="mt-0.5 font-semibold">{formatDate(offer.validFrom, locale)}</p></div></div>}
          {offer.validUntil && <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" style={{ color: colors.brandPrimary }} /><div><p className="text-xs" style={{ color: colors.textSecondary }}>{tr('Platí do')}</p><p className="mt-0.5 font-semibold">{formatDate(offer.validUntil, locale)}</p></div></div>}
        </div>}

        {offer.partnerAddress && <section><h3 className="text-sm font-semibold">{tr('Kde nabídku využít')}</h3><a href={mapUrl ?? '#'} target="_blank" rel="noreferrer" className="mt-2 flex min-h-11 items-center gap-2 text-sm font-semibold" style={{ color: colors.brandPrimary }}><MapPin size={17} /><span className="min-w-0 flex-1">{offer.partnerAddress}</span><ExternalLink size={16} /></a></section>}

        {(offer.partnerDescription || website) && <section><h3 className="text-sm font-semibold">{tr('O partnerovi')}</h3>{offer.partnerDescription && <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>{offer.partnerDescription}</p>}{website && <a href={website} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold" style={{ color: colors.brandPrimary }}>{tr('Web partnera')} <ExternalLink size={17} /></a>}</section>}

        {freshnessDate && <p className="flex items-center gap-2 border-t pt-4 text-xs" style={{ borderColor: colors.border, color: colors.textSecondary }}><CheckCircle2 size={16} style={{ color: offer.lastVerifiedAt ? colors.success : colors.textSecondary }} />{tr(offer.lastVerifiedAt ? 'Nabídka ověřena {date}' : 'Nabídka aktualizována {date}').replace('{date}', formatDate(freshnessDate, locale))}</p>}

        {hasActiveToken && <p className="text-xs leading-5" style={{ color: colors.textSecondary }}>{tr('Předchozí kód je aktivní na jiném zobrazení. Nový kód ho bezpečně nahradí.')}</p>}
        <button type="button" onClick={onRedeem} disabled={!isOnline || issuing} className="inline-flex min-h-12 w-full items-center justify-center gap-2 px-4 font-semibold text-white" style={{ borderRadius: radii.md, background: !isOnline || issuing ? colors.textSecondary : colors.brandPrimary }}>{issuing ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode size={20} />}{tr(isOnline ? 'Uplatnit slevu' : 'QR vyžaduje připojení')}</button>
        <p className="flex items-start gap-2 text-xs leading-5" style={{ color: colors.textSecondary }}><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: colors.success }} />{tr('Bezpečný kód platí 3 minuty a lze ho použít jen jednou.')}</p>

        <div className="border-t pt-2" style={{ borderColor: colors.border }}>
          <button type="button" onClick={() => { setReportOpen((current) => !current); setReportNotice(null); }} className="flex min-h-11 w-full items-center justify-center gap-2 text-sm font-semibold" style={{ color: colors.textSecondary }} aria-expanded={reportOpen}><Flag size={17} />{tr('Nahlásit problém s nabídkou')}</button>
          {reportOpen && <div className="space-y-3 pt-2">
            <select value={reason} onChange={(event) => setReason(event.target.value as IssueReason)} className="min-h-11 w-full border bg-white px-3 text-base" style={{ borderColor: colors.border, borderRadius: radii.md }} aria-label={tr('Typ problému')}>{(Object.entries(issueReasonLabels) as Array<[IssueReason, string]>).map(([value, label]) => <option key={value} value={value}>{tr(label)}</option>)}</select>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} placeholder={tr('Volitelné upřesnění bez osobních nebo citlivých údajů')} className="w-full resize-y border p-3 text-base" style={{ borderColor: colors.border, borderRadius: radii.md }} />
            {reportNotice && <p role="status" className="text-sm" style={{ color: reportNotice === 'success' ? colors.success : colors.dangerStrong }}>{tr(reportNotice === 'success' ? 'Děkujeme. Nabídku prověříme.' : 'Hlášení se nepodařilo odeslat.')}</p>}
            <button type="button" onClick={() => void handleReport()} disabled={!isOnline || reporting || reportNotice === 'success'} className="flex min-h-11 w-full items-center justify-center gap-2 border text-sm font-semibold" style={{ borderColor: colors.brandPrimary, borderRadius: radii.md, color: colors.brandPrimary }}>{reporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag size={16} />}{tr('Odeslat hlášení')}</button>
          </div>}
        </div>
        <button type="button" onClick={onChangeOffer} className="min-h-11 w-full font-semibold" style={{ color: colors.brandPrimary }}>{tr('Vybrat jinou výhodu')}</button>
      </div>
    </OfferPanel>
  );
}

export function TokenView({ token, onRegenerate, onDone, onReportProblem }: { token: IssuedToken; onRegenerate: () => void; onDone: () => void; onReportProblem: () => void }) {
  const { locale, tr } = useLocale();
  const submitExperience = useMutation(api.offerEngagement.submitRedemptionFeedback);
  const [now, setNow] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<RedemptionExperience | null>(null);
  const [feedbackWorking, setFeedbackWorking] = useState(false);
  const [feedbackError, setFeedbackError] = useState(false);
  const tokenStatus = useQuery(api.qr.statusForMember, { tokenId: token.tokenId });
  const redemptionAnnounced = useRef(false);
  const verificationUrl = typeof window === 'undefined' ? token.verificationPath : `${window.location.origin}${token.verificationPath}`;
  const expiresAt = tokenStatus?.expiresAt ?? token.expiresAt;
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const uiState = resolveMemberTokenUiState(tokenStatus?.status, expiresAt, now);

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (tokenStatus?.status !== 'redeemed' || redemptionAnnounced.current) return; redemptionAnnounced.current = true; navigator.vibrate?.([80, 40, 120]); }, [tokenStatus?.status]);

  const sendFeedback = async (experience: RedemptionExperience) => {
    if (feedbackWorking || feedback) return;
    setFeedbackWorking(true);
    setFeedbackError(false);
    try { await submitExperience({ tokenId: token.tokenId, experience }); setFeedback(experience); } catch { setFeedbackError(true); } finally { setFeedbackWorking(false); }
  };

  if (uiState === 'redeemed') {
    const redeemedAt = tokenStatus?.redeemedAt ?? tokenStatus?.scannedAt;
    const verifiedTime = redeemedAt ? new Intl.DateTimeFormat(getDateLocale(locale), { hour: '2-digit', minute: '2-digit' }).format(new Date(redeemedAt)) : null;
    return <OfferPanel className="overflow-hidden text-center">
      <div className="px-5 py-7" role="status" aria-live="polite" style={{ background: colors.successSurface }}><span className="mx-auto flex h-14 w-14 items-center justify-center" style={{ borderRadius: radii.full, background: colors.background, color: colors.success }}><CheckCircle2 size={32} /></span><h2 className="mt-4 text-xl font-semibold">{tr('Sleva byla ověřena')}</h2><p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>{tr('Výhoda je úspěšně uplatněná.')}</p>{verifiedTime && <p className="mt-2 text-xs font-semibold" style={{ color: colors.success }}>{tr('Ověřeno v {time}').replace('{time}', verifiedTime)}</p>}</div>
      <div className="border-t px-5 py-5" style={{ borderColor: colors.border }}><p className="text-sm font-semibold" style={{ color: colors.brandPrimary }}>{token.partner.name}</p><p className="mt-1 text-base font-semibold">{token.offer.title}</p><p className="mt-1 text-2xl font-bold" style={{ color: colors.brandPrimary }}>{token.offer.value}</p>
        <div className="mt-5 border-y py-4" style={{ borderColor: colors.border }}><p className="text-sm font-semibold">{tr('Proběhlo uplatnění bez problému?')}</p>{feedback ? <p className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold" style={{ color: colors.success }}><Check size={17} />{tr('Děkujeme za zpětnou vazbu.')}</p> : <div className="mt-3 grid grid-cols-3 gap-2"><button type="button" disabled={feedbackWorking} onClick={() => void sendFeedback('accepted')} className="flex min-h-11 flex-col items-center justify-center gap-1 border px-1 text-xs font-semibold" style={{ borderColor: colors.border, borderRadius: radii.md }}><Check size={18} style={{ color: colors.success }} />{tr('Ano')}</button><button type="button" disabled={feedbackWorking} onClick={() => void sendFeedback('not_accepted')} className="flex min-h-11 flex-col items-center justify-center gap-1 border px-1 text-xs font-semibold" style={{ borderColor: colors.border, borderRadius: radii.md }}><X size={18} style={{ color: colors.dangerStrong }} />{tr('Nepřijata')}</button><button type="button" disabled={feedbackWorking} onClick={() => void sendFeedback('problem')} className="flex min-h-11 flex-col items-center justify-center gap-1 border px-1 text-xs font-semibold" style={{ borderColor: colors.border, borderRadius: radii.md }}><CircleAlert size={18} style={{ color: '#92400e' }} />{tr('Jiný problém')}</button></div>}{feedbackError && <p className="mt-2 text-xs" role="alert" style={{ color: colors.dangerStrong }}>{tr('Hodnocení se nepodařilo odeslat.')}</p>}{(feedback === 'not_accepted' || feedback === 'problem') && <button type="button" onClick={onReportProblem} className="mt-3 min-h-10 text-sm font-semibold" style={{ color: colors.brandPrimary }}>{tr('Doplnit podrobnosti')}</button>}</div>
        <button type="button" onClick={onDone} className="min-h-12 w-full px-4 font-semibold text-white" style={{ borderRadius: radii.md, background: colors.brandPrimary }}>{tr('Použít další výhodu')}</button>
      </div>
    </OfferPanel>;
  }

  if (uiState === 'expired' || uiState === 'revoked') return <OfferPanel className="px-5 py-10 text-center"><WifiOff className="mx-auto h-8 w-8" style={{ color: colors.textSecondary }} /><p className="mt-3 font-semibold">{tr(uiState === 'revoked' ? 'Kód byl zneplatněn' : 'Kód vypršel')}</p><p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>{tr('Vytvoř nový kód a zkus ověření znovu.')}</p><button type="button" onClick={onRegenerate} className="mt-5 min-h-11 px-4 font-semibold text-white" style={{ borderRadius: radii.md, background: colors.brandPrimary }}>{tr('Vytvořit nový kód')}</button></OfferPanel>;

  return <OfferPanel className="overflow-hidden"><div className="border-b px-4 py-4" style={{ borderColor: colors.border }}><p className="text-xs font-semibold uppercase" style={{ color: colors.brandPrimary }}>{token.partner.name}</p><h2 className="mt-1 text-lg font-semibold">{token.offer.title}</h2><p className="mt-1 text-2xl font-bold" style={{ color: colors.brandPrimary }}>{token.offer.value}</p></div><div className="flex flex-col items-center px-5 py-5"><div className="bg-white p-3" style={{ borderRadius: radii.md }}><QRCode value={verificationUrl} size={210} bgColor="#FFFFFF" fgColor="#172033" /></div><p className="mt-4 font-mono text-xl font-semibold tracking-[0.12em]">{token.shortCode}</p><div className="mt-3 flex items-center gap-2 text-sm font-semibold" style={{ color: seconds <= 30 ? colors.dangerStrong : colors.success }}><CalendarDays size={17} />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</div><p className="mt-3 max-w-xs text-center text-xs leading-5" role="status" aria-live="polite" style={{ color: colors.textSecondary }}>{tr('Čekáme na naskenování obsluhou. Stav se aktualizuje automaticky.')}</p><p className="mt-1 max-w-xs text-center text-xs leading-5" style={{ color: colors.textSecondary }}>{tr('Obsluha naskenuje QR běžným fotoaparátem telefonu. Zobrazí se pouze platnost členství a nabídky.')}</p></div></OfferPanel>;
}
