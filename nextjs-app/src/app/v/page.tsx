'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, QrCode, ShieldCheck, XCircle } from 'lucide-react';
import PsychocasLogo from '@/components/PsychocasLogo';
import { colors, radii, shadows } from '@/ui/theme';

type ValidationResult = {
  status: 'idle' | 'loading' | 'valid' | 'already_validated' | 'expired' | 'revoked' | 'invalid' | 'error';
  checkedAt?: number;
  validatedAt?: number;
  offerTitle?: string;
  offerValue?: string;
  partnerName?: string;
};

function convexSiteUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  return cloud ? cloud.replace(/\.convex\.cloud\/?$/, '.convex.site') : null;
}

export default function PublicValidationPage() {
  const endpoint = useMemo(() => {
    const site = convexSiteUrl();
    return site ? `${site}/qr/validate` : null;
  }, []);
  const [shortCode, setShortCode] = useState('');
  const [result, setResult] = useState<ValidationResult>({ status: 'idle' });

  const validate = async (payload: { secret?: string; shortCode?: string }) => {
    if (!endpoint) {
      setResult({ status: 'error' });
      return;
    }
    setResult({ status: 'loading' });
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setResult({ status: 'invalid', checkedAt: Date.now() });
        return;
      }
      setResult((await response.json()) as ValidationResult);
    } catch {
      setResult({ status: 'error' });
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const secret = params.get('t');
    if (!secret) return;
    window.history.replaceState(null, '', '/v');
    void validate({ secret });
    // The token is read only once on initial navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const state = {
    valid: {
      title: 'Členství a nabídka jsou platné',
      note: 'Výhodu lze poskytnout. Kód byl právě jednorázově ověřen.',
      Icon: CheckCircle2,
      color: colors.success,
      surface: colors.successSurface,
    },
    already_validated: {
      title: 'Kód už byl ověřen',
      note: 'Tento jednorázový kód už byl použit. Zkontroluj čas prvního ověření.',
      Icon: Clock3,
      color: '#92400e',
      surface: colors.warningSurface,
    },
    expired: {
      title: 'Platnost kódu vypršela',
      note: 'Člen musí v aplikaci vytvořit nový QR kód.',
      Icon: Clock3,
      color: '#92400e',
      surface: colors.warningSurface,
    },
    revoked: {
      title: 'Kód byl zneplatněn',
      note: 'Požádej člena o vytvoření nového QR kódu.',
      Icon: XCircle,
      color: colors.dangerStrong,
      surface: colors.dangerSurface,
    },
    invalid: {
      title: 'Kód není platný',
      note: 'Kód neexistuje nebo členství či nabídka už nejsou aktivní.',
      Icon: XCircle,
      color: colors.dangerStrong,
      surface: colors.dangerSurface,
    },
  } as const;

  const finalState = result.status in state ? state[result.status as keyof typeof state] : null;

  return (
    <main className="min-h-screen px-4 py-5 sm:py-10" style={{ background: colors.backgroundMuted }}>
      <div className="mx-auto w-full max-w-md">
        <header className="mb-5 flex items-center gap-3 px-1">
          <PsychocasLogo size={42} />
          <div>
            <p className="text-sm font-bold" style={{ color: colors.brandPrimary }}>Psychočas</p>
            <h1 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>Ověření členské výhody</h1>
          </div>
        </header>

        {(result.status === 'idle' || result.status === 'loading' || result.status === 'error') && (
          <section className="border bg-white px-5 py-6" style={{ borderColor: colors.border, borderRadius: radii.md, boxShadow: shadows.sm }}>
            {result.status === 'loading' ? (
              <div className="flex min-h-48 flex-col items-center justify-center text-center" role="status">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.brandPrimary }} />
                <p className="mt-4 font-semibold" style={{ color: colors.textPrimary }}>Ověřuji kód…</p>
                <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>Výsledek se nikdy nenačítá z cache.</p>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center" style={{ borderRadius: radii.md, background: colors.brandSurface, color: colors.brandPrimary }}><QrCode size={20} /></span>
                  <div>
                    <h2 className="font-semibold" style={{ color: colors.textPrimary }}>{result.status === 'error' ? 'Ověření je dočasně nedostupné' : 'Zadat krátký kód'}</h2>
                    <p className="mt-1 text-sm leading-6" style={{ color: colors.textSecondary }}>{result.status === 'error' ? 'Zkontroluj připojení a zkus to znovu.' : 'Pokud nejde načíst QR, zadej osmimístný kód z členské aplikace.'}</p>
                  </div>
                </div>
                <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); void validate({ shortCode }); }}>
                  <input value={shortCode} onChange={(event) => setShortCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} inputMode="text" autoCapitalize="characters" autoComplete="off" placeholder="ABCD2345" aria-label="Osmimístný ověřovací kód" className="min-h-12 w-full border px-3 text-center font-mono text-xl font-semibold tracking-[0.12em]" style={{ borderColor: colors.border, borderRadius: radii.md }} />
                  <button type="submit" disabled={shortCode.length !== 8} className="min-h-12 w-full font-semibold text-white" style={{ borderRadius: radii.md, background: shortCode.length === 8 ? colors.brandPrimary : colors.textSecondary }}>Ověřit kód</button>
                </form>
              </>
            )}
          </section>
        )}

        {finalState && (
          <section className="border px-5 py-6 text-center" style={{ borderColor: finalState.color, borderRadius: radii.md, background: finalState.surface, boxShadow: shadows.sm }}>
            <finalState.Icon className="mx-auto h-12 w-12" style={{ color: finalState.color }} />
            <h2 className="mt-4 text-xl font-semibold" style={{ color: finalState.color }}>{finalState.title}</h2>
            <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>{finalState.note}</p>
            {result.offerTitle && (
              <dl className="mt-5 divide-y border-y text-left" style={{ borderColor: colors.border }}>
                <div className="flex justify-between gap-4 py-3"><dt className="text-sm" style={{ color: colors.textSecondary }}>Partner</dt><dd className="text-right text-sm font-semibold">{result.partnerName}</dd></div>
                <div className="flex justify-between gap-4 py-3"><dt className="text-sm" style={{ color: colors.textSecondary }}>Nabídka</dt><dd className="text-right text-sm font-semibold">{result.offerTitle}</dd></div>
                <div className="flex justify-between gap-4 py-3"><dt className="text-sm" style={{ color: colors.textSecondary }}>Hodnota</dt><dd className="text-right text-sm font-bold" style={{ color: colors.brandPrimary }}>{result.offerValue}</dd></div>
                <div className="flex justify-between gap-4 py-3"><dt className="text-sm" style={{ color: colors.textSecondary }}>Ověřeno</dt><dd className="text-right text-sm font-semibold">{new Date(result.validatedAt ?? result.checkedAt ?? Date.now()).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</dd></div>
              </dl>
            )}
            <button type="button" onClick={() => { setResult({ status: 'idle' }); setShortCode(''); }} className="mt-5 min-h-11 w-full border bg-white font-semibold" style={{ borderColor: colors.border, borderRadius: radii.md, color: colors.brandPrimary }}>Ověřit další kód</button>
          </section>
        )}

        <footer className="mt-5 flex items-start gap-2 px-2 text-xs leading-5" style={{ color: colors.textSecondary }}>
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Ověření nezobrazuje jméno, email ani přesné datum členství.
        </footer>
      </div>
    </main>
  );
}
