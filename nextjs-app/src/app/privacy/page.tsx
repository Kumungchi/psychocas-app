'use client';

import Link from 'next/link';
import { ArrowLeft, Database, Mail, ShieldCheck, UserRoundCheck } from 'lucide-react';
import PsychocasLogo from '@/components/PsychocasLogo';
import useLocale from '@/hooks/useLocale';
import { colors, radii } from '@/ui/theme';

const privacyContact = process.env.NEXT_PUBLIC_PRIVACY_CONTACT ?? 'info@psychocas.cz';

export default function PrivacyPage() {
  const { tr } = useLocale();
  return (
    <main className="min-h-screen" style={{ background: colors.backgroundMuted, color: colors.textPrimary }}>
      <header className="border-b bg-white" style={{ borderColor: colors.border }}>
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <Link href="/home" className="flex h-10 w-10 items-center justify-center border" aria-label={tr('Zpět')} style={{ borderColor: colors.border, borderRadius: radii.md }}><ArrowLeft size={19} /></Link>
          <PsychocasLogo size={38} />
          <div><p className="text-sm font-bold" style={{ color: colors.brandPrimary }}>Psychočas</p><h1 className="text-base font-semibold" style={{ color: colors.textPrimary }}>{tr('Ochrana osobních údajů')}</h1></div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-7 sm:px-6 sm:py-10">
        <section>
          <p className="text-sm font-semibold" style={{ color: colors.brandPrimary }}>{tr('Stručně a srozumitelně')}</p>
          <h2 className="mt-2 text-2xl font-semibold" style={{ color: colors.textPrimary }}>{tr('Soukromí je součást návrhu aplikace')}</h2>
          <p className="mt-3 max-w-2xl leading-7" style={{ color: colors.textSecondary }}>{tr('Psychočas používá údaje potřebné pro správu členství, zpřístupnění partnerských výhod, zabezpečení účtu a provoz aplikace. Veřejné QR ověření nezobrazuje jméno ani kontaktní údaje.')}</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {[
            { Icon: UserRoundCheck, title: 'Členství', text: 'Email, jméno, pobočka, stav a platnost členství slouží k přihlášení a zpřístupnění výhod.' },
            { Icon: ShieldCheck, title: 'Bezpečnost', text: 'OTP rate limits, session a audit změn chrání členské a správcovské účty.' },
            { Icon: Database, title: 'Agregované metriky', text: 'Použití QR se po krátké provozní době převádí na souhrny bez členského žebříčku nebo behaviorálního profilu.' },
            { Icon: Mail, title: 'Preference', text: 'Oznámení jsou volitelná. Preference lze kdykoli změnit v profilu.' },
          ].map(({ Icon, title, text }) => (
            <article key={title} className="border bg-white p-5" style={{ borderColor: colors.border, borderRadius: radii.md }}><Icon className="h-6 w-6" style={{ color: colors.brandPrimary }} /><h3 className="mt-3 font-semibold">{tr(title)}</h3><p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>{tr(text)}</p></article>
          ))}
        </section>

        <section className="border-y py-6" style={{ borderColor: colors.border }}>
          <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{tr('Správce a účely')}</h2>
          <p className="mt-2 leading-7" style={{ color: colors.textSecondary }}>{tr('Psychočas, z.s., IČO 08952604, Šlechtitelů 813/21, 779 00 Olomouc, je správcem údajů v členské aplikaci. Údaje používá pro správu členství a přístupu, poskytování výhod a událostí, zabezpečení služby a vyřízení požadavků členů.')}</p>
          <p className="mt-3 leading-7" style={{ color: colors.textSecondary }}>{tr('Zpracování se opírá o plnění členského vztahu, oprávněný zájem na bezpečném provozu a plnění právních povinností. Volitelná push oznámení vyžadují souhlas v profilu i oprávnění zařízení a lze je kdykoli vypnout.')}</p>
        </section>

        <section className="border-b pb-6" style={{ borderColor: colors.border }}>
          <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{tr('Uložení a příjemci')}</h2>
          <ul className="mt-2 space-y-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
            <li>{tr('Technické QR události se mažou po 30 dnech, navázané QR záznamy po 31 dnech a doručovací logy po 90 dnech.')}</li>
            <li>{tr('OTP rate-limit záznamy se mažou po 24 hodinách neaktivity. Tajný QR kód se v databázi neukládá v čitelné podobě.')}</li>
            <li>{tr('Členský profil, přístupy, audit a privacy požadavky se uchovávají po dobu členství a následně jen po dobu stanovenou retenčním plánem spolku nebo právní povinností.')}</li>
            <li>{tr('Technickými zpracovateli jsou Convex (databáze a backend v EU regionu Irsko), Vercel (hosting webové aplikace) a Resend (doručení přihlašovacích emailů). Resend zpracovává data v USA; přenos je smluvně zajištěn standardními smluvními doložkami.')}</li>
          </ul>
          <p className="mt-3 text-sm leading-6" style={{ color: colors.textSecondary }}>{tr('Aplikace neprovádí automatizované rozhodování, nevytváří členské behaviorální profily a ve feedbacku nemají být uváděny údaje o zdraví ani jiné citlivé údaje.')}</p>
        </section>

        <section className="border-b pb-6" style={{ borderColor: colors.border }}>
          <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{tr('Tvoje práva')}</h2>
          <p className="mt-2 leading-7" style={{ color: colors.textSecondary }}>{tr('V profilu si můžeš stáhnout strukturovaný export a požádat o přístup, opravu, výmaz, omezení zpracování nebo vznést námitku. Požadavek posoudí oprávněná osoba Psychočasu a aplikace ukáže jeho stav. Máš také právo podat stížnost u Úřadu pro ochranu osobních údajů.')}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{tr('Kontakt')}</h2>
          <p className="mt-2 leading-7" style={{ color: colors.textSecondary }}>{tr('Dotazy k soukromí a zpracování údajů směřuj na')} <a href={`mailto:${privacyContact}`} className="font-semibold" style={{ color: colors.brandPrimary }}>{privacyContact}</a>. {tr('Verze informací pro pilot: 13. 7. 2026. Změny účelů, retenčních lhůt nebo zpracovatelů zveřejníme před jejich účinností.')}</p>
        </section>
      </div>
    </main>
  );
}
