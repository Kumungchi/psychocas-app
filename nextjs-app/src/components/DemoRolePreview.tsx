'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Check,
  ClipboardCheck,
  Globe2,
  Home,
  MapPin,
  QrCode,
  Settings2,
  Store,
  Tags,
  UserRound,
  Users,
} from 'lucide-react';
import PsychocasLogo from '@/components/PsychocasLogo';
import useLocale from '@/hooks/useLocale';

export type DemoRole = 'member' | 'manager' | 'board';

const roleLabels: Record<DemoRole, string> = {
  member: 'Členský pohled',
  manager: 'Manažerský pohled',
  board: 'Board pohled',
};

const offers = [
  { partner: 'Nakladatelství Portál', title: 'Odborné knihy', value: '20 %', national: true },
  { partner: 'Praktická psychologie', title: 'Workshopy a kurzy', value: '15 %', national: true },
  { partner: 'Kavárna Kampus', title: 'Káva a drobné občerstvení', value: '10 %', national: false },
];

function DemoTopbar({ role }: { role: DemoRole }) {
  const { tr } = useLocale();
  return (
    <header className="border-b border-[#dde7f0] bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <Link href="/demo" className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#dde7f0]" aria-label={tr('Zpět na demo')}><ArrowLeft size={18} /></Link>
        <PsychocasLogo size={38} gradientId={`demo-${role}`} />
        <div className="min-w-0 flex-1"><p className="text-sm font-bold text-[#1d4f7d]">Psychočas</p><h1 className="truncate text-base font-semibold text-[#172033]">{tr(roleLabels[role])}</h1></div>
        <span className="rounded-md bg-[#eaf5ff] px-2 py-1 text-xs font-semibold text-[#1d4f7d]">DEMO</span>
      </div>
    </header>
  );
}

function MemberPreview() {
  const { tr } = useLocale();
  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-5 pb-24">
      <div><p className="text-sm text-[#536273]">{tr('Ahoj,')}</p><h2 className="mt-1 text-2xl font-semibold text-[#172033]">Karolína Nováková</h2></div>
      <section className="overflow-hidden rounded-lg border border-[#d8e5ef] bg-white shadow-sm">
        <div className="flex items-start justify-between bg-[#1d4f7d] px-5 py-5 text-white"><div><p className="text-xs font-semibold uppercase text-white/75">{tr('Digitální členství')}</p><h3 className="mt-1 text-lg font-semibold text-white">{tr('Aktivní do 30. června 2027')}</h3><p className="mt-1 text-sm text-white/75">{tr('Pobočka Praha')}</p></div><Check size={26} /></div>
        <div className="grid grid-cols-2 divide-x divide-[#dde7f0] border-t border-[#dde7f0]"><div className="px-4 py-3"><p className="text-xs text-[#536273]">{tr('Role')}</p><p className="mt-1 text-sm font-semibold">{tr('Člen')}</p></div><div className="px-4 py-3"><p className="text-xs text-[#536273]">{tr('Výhody')}</p><p className="mt-1 text-sm font-semibold">{tr('12 dostupných')}</p></div></div>
      </section>
      <button type="button" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1d4f7d] px-4 font-semibold text-white"><QrCode size={20} /> {tr('Vytvořit QR kód')}</button>
      <section><div className="mb-2 flex items-end justify-between"><div><h2 className="text-base font-semibold text-[#172033]">{tr('Aktuální výhody')}</h2><p className="text-xs text-[#536273]">{tr('Podle členství a pobočky')}</p></div><span className="text-sm font-semibold text-[#1d4f7d]">{tr('Všechny')}</span></div><div className="overflow-hidden rounded-lg border border-[#dde7f0] bg-white">{offers.map((offer) => <div key={offer.partner} className="flex min-h-[76px] items-center gap-3 border-b border-[#dde7f0] px-4 py-3 last:border-0"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#eaf5ff] text-[#1d4f7d]">{offer.national ? <Globe2 size={20} /> : <MapPin size={20} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{offer.partner}</p><p className="truncate text-sm text-[#536273]">{tr(offer.title)}</p></div><strong className="rounded-md bg-[#1d4f7d] px-2 py-1 text-xs text-white">{offer.value}</strong></div>)}</div></section>
      <section><h2 className="mb-2 text-base font-semibold text-[#172033]">{tr('Nejbližší událost')}</h2><div className="flex gap-3 rounded-lg border border-[#dde7f0] bg-white px-4 py-4"><CalendarDays className="shrink-0 text-[#1d4f7d]" size={22} /><div><h3 className="text-sm font-semibold">{tr('Setkání členů Psychočasu')}</h3><p className="mt-1 text-xs text-[#536273]">{tr('21. září, 17:30 · Kampus Hybernská')}</p></div></div></section>
      <nav className="fixed inset-x-0 bottom-0 border-t border-[#dde7f0] bg-white"><div className="mx-auto grid h-16 max-w-md grid-cols-4">{[[Home, 'Domů'], [Tags, 'Výhody'], [QrCode, 'QR karta'], [UserRound, 'Profil']].map(([Icon, label], index) => { const NavIcon = Icon as typeof Home; return <span key={String(label)} className={`flex flex-col items-center justify-center gap-1 text-xs font-semibold ${index === 0 ? 'text-[#1d4f7d]' : 'text-[#607086]'}`}><NavIcon size={20} />{tr(String(label))}</span>; })}</div></nav>
    </div>
  );
}

function ManagementPreview({ role }: { role: 'manager' | 'board' }) {
  const { tr } = useLocale();
  const board = role === 'board';
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6 sm:py-7">
      <section className="grid gap-3 rounded-lg border border-[#dde7f0] bg-white p-3 sm:grid-cols-[auto_1fr] sm:items-center"><div className="grid grid-cols-2 gap-1 rounded-lg border border-[#dde7f0] p-1"><button type="button" className="flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#1d4f7d] px-3 text-sm font-semibold text-white"><Globe2 size={16} /> {tr('Národní')}</button><button type="button" className="flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-[#536273]"><MapPin size={16} /> {tr('Lokální')}</button></div><p className="text-sm text-[#536273]">{tr('Scope řídí, které záznamy lze zobrazit a upravit.')}</p></section>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[{ label: 'Aktivní členové', value: '842' }, { label: 'Validní QR', value: '126' }, { label: 'Partneři', value: '34' }, { label: 'Úspěšnost', value: '91 %' }].map((metric) => <section key={metric.label} className="rounded-lg border border-[#dde7f0] bg-white px-4 py-4"><p className="text-xs text-[#536273]">{tr(metric.label)}</p><p className="mt-1 text-2xl font-bold text-[#1d4f7d]">{metric.value}</p></section>)}</div>
      <div className="grid gap-4 lg:grid-cols-[1fr_21rem]">
        <section className="overflow-hidden rounded-lg border border-[#dde7f0] bg-white"><div className="border-b border-[#dde7f0] px-4 py-4"><h2 className="font-semibold text-[#172033]">{tr(board ? 'Čeká na rozhodnutí' : 'Aktivní nabídky')}</h2><p className="text-sm text-[#536273]">{tr(board ? 'Workflow s dohledatelným schválením' : 'Obsah v povoleném scope')}</p></div><div className="divide-y divide-[#dde7f0]">{offers.map((offer, index) => <article key={offer.partner} className="px-4 py-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eaf5ff] text-[#1d4f7d]">{board ? <ClipboardCheck size={18} /> : <Store size={18} />}</span><div className="min-w-0 flex-1"><h3 className="font-semibold">{tr(offer.title)}</h3><p className="mt-1 text-sm text-[#536273]">{offer.partner} · <strong className="text-[#1d4f7d]">{offer.value}</strong></p></div></div>{board && index < 2 && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" className="min-h-10 rounded-lg border border-[#dde7f0] text-sm font-semibold">{tr('Vrátit')}</button><button type="button" className="min-h-10 rounded-lg bg-[#1d4f7d] text-sm font-semibold text-white">{tr('Schválit')}</button></div>}</article>)}</div></section>
        <div className="space-y-4">{board ? <><section className="rounded-lg border border-[#dde7f0] bg-white p-4"><div className="flex items-center gap-2"><Users size={19} className="text-[#1d4f7d]" /><h2 className="font-semibold">{tr('Členství')}</h2></div><p className="mt-2 text-sm leading-6 text-[#536273]">{tr('Filtrování, hromadný výběr a změna platnosti pouze pro board a admin.')}</p><button type="button" className="mt-4 min-h-11 w-full rounded-lg bg-[#1d4f7d] font-semibold text-white">{tr('Spravovat členy')}</button></section><section className="rounded-lg border border-[#dde7f0] bg-white p-4"><div className="flex items-center gap-2"><Settings2 size={19} className="text-[#1d4f7d]" /><h2 className="font-semibold">{tr('Privacy fronta')}</h2></div><p className="mt-2 text-sm text-[#536273]">{tr('2 otevřené požadavky · bez behaviorálních profilů')}</p></section></> : <><section className="rounded-lg border border-[#dde7f0] bg-white p-4"><div className="flex items-center gap-2"><BarChart3 size={19} className="text-[#1d4f7d]" /><h2 className="font-semibold">{tr('Anonymní metriky')}</h2></div><p className="mt-2 text-sm leading-6 text-[#536273]">{tr('Agregované využití výhod bez historie jednotlivých členů.')}</p></section><section className="rounded-lg border border-[#dde7f0] bg-white p-4"><div className="flex items-center gap-2"><CalendarDays size={19} className="text-[#1d4f7d]" /><h2 className="font-semibold">{tr('Události')}</h2></div><p className="mt-2 text-sm text-[#536273]">{tr('3 plánované · check-in připraven')}</p></section></>}</div>
      </div>
    </div>
  );
}

export default function DemoRolePreview({ role }: { role: DemoRole }) {
  return <main className="min-h-screen bg-[#f6f8fb] text-[#172033]"><DemoTopbar role={role} />{role === 'member' ? <MemberPreview /> : <ManagementPreview role={role} />}</main>;
}
