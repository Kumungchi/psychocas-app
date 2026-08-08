'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Flag,
  Home,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  Menu,
  Monitor,
  Search,
  ShieldCheck,
  Store,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import PsychocasLogo from '@/components/PsychocasLogo';

type GuideSection = {
  id: string;
  label: string;
  description: string;
  icon: typeof Users;
};

const sections: GuideSection[] = [
  { id: 'zacatek', label: 'Začínáme', description: 'Přihlášení a orientace', icon: Home },
  { id: 'clenove', label: 'Správa členů', description: 'Přidání, úpravy a CSV', icon: Users },
  { id: 'role', label: 'Role a oprávnění', description: 'Kdo může co dělat', icon: UserCog },
  { id: 'partneri', label: 'Partneři a nabídky', description: 'Od návrhu po zveřejnění', icon: Store },
  { id: 'schvaleni', label: 'Schvalování', description: 'Bezpečná kontrola změn', icon: ClipboardCheck },
  { id: 'potize', label: 'Když něco nefunguje', description: 'Rychlá první pomoc', icon: LifeBuoy },
];

const searchableContent: Record<string, string> = {
  zacatek: 'začínáme přihlášení login email kód administrace pracovní prostor národní lokální pobočka',
  clenove: 'člen členové přidat upravit deaktivovat prodloužit členství csv import hromadná změna email',
  role: 'role oprávnění přístup koordinátor manažer board admin scope pobočka odebrat',
  partneri: 'partner partneři nabídka sleva vytvořit upravit publikovat lokální národní platnost',
  schvaleni: 'schválení publikovat vrátit koncept draft nabídka kontrola podmínky',
  potize: 'problém nejde přihlášení email otp nabídka není vidět qr oprávnění pomoc incident',
};

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2.25rem_1fr] gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1d4f7d] text-sm font-bold text-white">
        {number}
      </span>
      <div className="pt-1">
        <p className="font-semibold text-[#172033]">{title}</p>
        <div className="mt-1 text-sm leading-6 text-[#536273]">{children}</div>
      </div>
    </li>
  );
}

function Callout({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warning' | 'success' }) {
  const styles = {
    info: 'border-[#b9dcf5] bg-[#eef8ff] text-[#12385b]',
    warning: 'border-[#f4d38b] bg-[#fff8e8] text-[#68480a]',
    success: 'border-[#a7dfca] bg-[#effbf6] text-[#075c45]',
  };
  return <div className={`rounded-lg border px-4 py-3 text-sm leading-6 ${styles[tone]}`}>{children}</div>;
}

function Marker({ number, className }: { number: number; className: string }) {
  return (
    <span className={`absolute z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#049edb] text-xs font-bold text-white shadow-lg ring-4 ring-white ${className}`}>
      {number}
    </span>
  );
}

function MembersPreview() {
  return (
    <figure>
      <div className="relative overflow-hidden rounded-xl border border-[#ccd9e5] bg-[#f6f8fb] shadow-[0_18px_50px_rgba(23,32,51,0.12)]">
        <div className="flex items-center gap-2 border-b border-[#dde7f0] bg-white px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ef6a66]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f0c24f]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#63c174]" />
          <span className="ml-3 text-[11px] font-medium text-[#738094]">app.psychocas.cz/admin</span>
        </div>
        <div className="p-4 sm:p-5">
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#1d4f7d]">Psychočas</p>
            <p className="mt-1 text-base font-bold text-[#172033]">Správa členství</p>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#dde7f0] bg-white p-1 text-center text-[11px] font-semibold">
            <span className="rounded-md bg-[#1d4f7d] px-2 py-2 text-white">Členové</span>
            <span className="px-2 py-2 text-[#607086]">Pobočky</span>
            <span className="px-2 py-2 text-[#607086]">Role</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_0.72fr]">
            <div className="rounded-lg border border-[#dde7f0] bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#172033]">Seznam členů</span>
                <span className="rounded-md bg-[#eaf5ff] px-2 py-1 text-[10px] font-bold text-[#1d4f7d]">Import CSV</span>
              </div>
              <div className="mt-3 space-y-2">
                {['Anna Nováková', 'Jan Dvořák', 'Klára Malá'].map((name, index) => (
                  <div key={name} className="flex items-center gap-2 rounded-md bg-[#f6f8fb] p-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#dff4ff] text-[9px] font-bold text-[#1d4f7d]">{name.split(' ').map((part) => part[0]).join('')}</span>
                    <span className="min-w-0 flex-1 truncate text-[10px] font-semibold">{name}</span>
                    <span className={`text-[9px] font-bold ${index === 2 ? 'text-[#b66a00]' : 'text-[#047857]'}`}>{index === 2 ? 'Končí brzy' : 'Aktivní'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[#dde7f0] bg-white p-3">
              <p className="text-xs font-bold">Nový člen</p>
              <div className="mt-3 space-y-2">
                {['Email', 'Jméno a příjmení', 'Pobočka', 'Členství do'].map((label) => <div key={label} className="rounded-md border border-[#dde7f0] px-2 py-1.5 text-[9px] text-[#738094]">{label}</div>)}
                <div className="rounded-md bg-[#1d4f7d] py-2 text-center text-[10px] font-bold text-white">Uložit člena</div>
              </div>
            </div>
          </div>
        </div>
        <Marker number={1} className="left-[9%] top-[30%]" />
        <Marker number={2} className="right-[32%] top-[45%]" />
        <Marker number={3} className="bottom-[11%] right-[5%]" />
      </div>
      <figcaption className="mt-4 grid gap-2 text-xs text-[#536273] sm:grid-cols-3">
        <span><strong className="text-[#1d4f7d]">1</strong> Vyberte část administrace.</span>
        <span><strong className="text-[#1d4f7d]">2</strong> Najděte existujícího člena.</span>
        <span><strong className="text-[#1d4f7d]">3</strong> Nového člena uložte formulářem.</span>
      </figcaption>
    </figure>
  );
}

function OffersPreview() {
  return (
    <figure>
      <div className="relative overflow-hidden rounded-xl border border-[#ccd9e5] bg-[#f6f8fb] shadow-[0_18px_50px_rgba(23,32,51,0.12)]">
        <div className="flex items-center gap-3 border-b border-[#dde7f0] bg-white px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[#dde7f0]"><ChevronRight className="h-3.5 w-3.5 rotate-180" /></span>
          <span className="text-xs font-bold text-[#172033]">Pracovní prostor</span>
        </div>
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#dde7f0] bg-white p-1 text-center text-[10px] font-semibold sm:w-64">
            <span className="rounded-md bg-[#1d4f7d] px-2 py-2 text-white">Národní</span>
            <span className="px-2 py-2 text-[#607086]">Lokální</span>
          </div>
          <div className="mt-3 flex gap-1 overflow-hidden rounded-lg border border-[#dde7f0] bg-white p-1 text-[10px] font-semibold">
            <span className="px-3 py-2 text-[#607086]">Partneři</span>
            <span className="rounded-md bg-[#1d4f7d] px-3 py-2 text-white">Nabídky</span>
            <span className="px-3 py-2 text-[#607086]">Hlášení</span>
            <span className="px-3 py-2 text-[#607086]">Schválení</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_0.72fr]">
            <div className="rounded-lg border border-[#dde7f0] bg-white p-3">
              <p className="text-xs font-bold">Nabídky</p>
              <div className="mt-3 space-y-2">
                <div className="rounded-md border border-[#dde7f0] p-3">
                  <div className="flex justify-between gap-2"><span className="text-[11px] font-bold">15 % na kávu</span><span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-[9px] font-bold text-[#8a5a00]">Koncept</span></div>
                  <p className="mt-1 text-[9px] text-[#738094]">Kavárna U Mostu · Národní</p>
                  <span className="mt-2 inline-block rounded-md border border-[#1d4f7d] px-2 py-1 text-[9px] font-bold text-[#1d4f7d]">Ke schválení</span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-[#dde7f0] bg-white p-3">
              <p className="text-xs font-bold">Nová nabídka</p>
              <div className="mt-3 space-y-2">
                {['Partner', 'Název nabídky', 'Hodnota', 'Platnost do'].map((label) => <div key={label} className="rounded-md border border-[#dde7f0] px-2 py-1.5 text-[9px] text-[#738094]">{label}</div>)}
                <div className="rounded-md bg-[#1d4f7d] py-2 text-center text-[10px] font-bold text-white">Uložit nabídku</div>
              </div>
            </div>
          </div>
        </div>
        <Marker number={1} className="left-[9%] top-[20%]" />
        <Marker number={2} className="left-[22%] top-[34%]" />
        <Marker number={3} className="bottom-[13%] left-[28%]" />
      </div>
      <figcaption className="mt-4 grid gap-2 text-xs text-[#536273] sm:grid-cols-3">
        <span><strong className="text-[#1d4f7d]">1</strong> Nejdřív zkontrolujte rozsah.</span>
        <span><strong className="text-[#1d4f7d]">2</strong> Otevřete modul Nabídky.</span>
        <span><strong className="text-[#1d4f7d]">3</strong> Koncept po kontrole odešlete.</span>
      </figcaption>
    </figure>
  );
}

function GuideArticle({ id, title, eyebrow, children }: { id: string; title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <article id={id} className="scroll-mt-24 rounded-xl border border-[#dde7f0] bg-white p-5 shadow-[0_1px_3px_rgba(23,32,51,0.06)] sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#049edb]">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#12385b] sm:text-3xl">{title}</h2>
      <div className="mt-6">{children}</div>
    </article>
  );
}

export default function AdminGuide() {
  const [query, setQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase('cs');
  const visibleIds = useMemo(() => new Set(sections.filter((section) => !normalizedQuery || `${section.label} ${section.description} ${searchableContent[section.id]}`.toLocaleLowerCase('cs').includes(normalizedQuery)).map((section) => section.id)), [normalizedQuery]);

  const jumpTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main data-admin-guide className="min-h-screen bg-[#f6f8fb] text-[#172033]">
      <header className="sticky top-0 z-40 border-b border-[#dde7f0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#049edb]" aria-label="Psychočas – úvod">
            <PsychocasLogo size={34} />
          </Link>
          <span className="hidden h-6 w-px bg-[#dde7f0] sm:block" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#172033]">Nápověda pro správce</p>
            <p className="hidden text-xs text-[#738094] sm:block">Jednoduše a krok za krokem</p>
          </div>
          <Link href="/login" className="hidden min-h-10 items-center gap-2 rounded-lg border border-[#dde7f0] px-3 text-sm font-semibold text-[#1d4f7d] hover:bg-[#f6f8fb] sm:inline-flex">
            Otevřít aplikaci <ArrowRight className="h-4 w-4" />
          </Link>
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#dde7f0] lg:hidden" onClick={() => setMobileMenuOpen((current) => !current)} aria-label="Otevřít obsah nápovědy" aria-expanded={mobileMenuOpen}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <nav className="fixed inset-x-0 top-16 z-30 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-[#dde7f0] bg-white p-4 shadow-xl lg:hidden">
          {sections.map((section) => <button key={section.id} type="button" onClick={() => jumpTo(section.id)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-[#f6f8fb]"><section.icon className="h-5 w-5 text-[#1d4f7d]" /><span><strong className="block text-sm">{section.label}</strong><span className="text-xs text-[#738094]">{section.description}</span></span></button>)}
        </nav>
      )}

      <div className="mx-auto grid max-w-[90rem] lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#dde7f0] bg-white lg:block">
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-5">
            <label className="flex items-center gap-2 rounded-lg border border-[#ccd9e5] bg-white px-3 focus-within:border-[#049edb] focus-within:ring-2 focus-within:ring-[#dff4ff]">
              <Search className="h-4 w-4 shrink-0 text-[#738094]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat v nápovědě" className="min-h-11 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
            </label>
            <nav className="mt-5 space-y-1" aria-label="Obsah nápovědy">
              {sections.map((section) => {
                const Icon = section.icon;
                return <button key={section.id} type="button" onClick={() => jumpTo(section.id)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-[#eef8ff]"><Icon className="h-5 w-5 shrink-0 text-[#1d4f7d]" /><span className="min-w-0"><strong className="block truncate text-sm">{section.label}</strong><span className="block truncate text-xs text-[#738094]">{section.description}</span></span></button>;
              })}
            </nav>
            <Callout>
              <span className="flex items-start gap-2"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /> Nápověda neobsahuje hesla, členská data ani tajné klíče.</span>
            </Callout>
          </div>
        </aside>

        <div className="min-w-0 px-4 py-6 sm:px-6 sm:py-10 lg:px-10 xl:px-14">
          <section className="relative overflow-hidden rounded-2xl bg-[#12385b] px-5 py-8 text-white shadow-xl sm:px-9 sm:py-11">
            <div className="relative z-10 max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-white/20"><Monitor className="h-4 w-4" /> Webový průvodce</span>
              <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">Správa aplikace bez technických znalostí</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#d9ebf8] sm:text-lg">Vyberte, co potřebujete udělat. Každý návod používá stejné názvy, které uvidíte přímo v aplikaci.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => jumpTo('clenove')} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-[#12385b]">Spravovat členy <ArrowRight className="h-4 w-4" /></button>
                <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/30 px-4 text-sm font-bold text-white hover:bg-white/10"><Download className="h-4 w-4" /> Uložit jako PDF</button>
              </div>
            </div>
            <BookOpen className="absolute -bottom-12 -right-8 h-64 w-64 text-white/[0.06]" aria-hidden />
          </section>

          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Rychlé volby">
            {sections.slice(1, 4).map((section) => { const Icon = section.icon; return <button key={section.id} type="button" onClick={() => jumpTo(section.id)} className="group flex items-center gap-4 rounded-xl border border-[#dde7f0] bg-white p-4 text-left shadow-sm hover:border-[#9fc9e7] hover:shadow-md"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#eaf5ff] text-[#1d4f7d]"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block">{section.label}</strong><span className="text-sm text-[#738094]">{section.description}</span></span><ChevronRight className="h-5 w-5 text-[#9aabba] transition-transform group-hover:translate-x-1" /></button>; })}
          </section>

          {normalizedQuery && visibleIds.size === 0 && <div className="mt-8 rounded-xl border border-[#dde7f0] bg-white p-8 text-center"><CircleHelp className="mx-auto h-8 w-8 text-[#738094]" /><h2 className="mt-3 font-bold">Nic jsme nenašli</h2><p className="mt-1 text-sm text-[#536273]">Zkuste kratší výraz, například „člen“, „role“ nebo „nabídka“.</p><button type="button" onClick={() => setQuery('')} className="mt-4 text-sm font-bold text-[#1d4f7d]">Zrušit hledání</button></div>}

          <div className="mt-8 space-y-6">
            {visibleIds.has('zacatek') && <GuideArticle id="zacatek" eyebrow="Než začnete" title="Kde co najdu">
              <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
                <div>
                  <p className="leading-7 text-[#536273]">Po přihlášení uvidí každý člověk jen ty části aplikace, ke kterým má oprávnění. Pokud nějaká záložka chybí, většinou nejde o chybu.</p>
                  <ul className="mt-5 space-y-4">
                    <Step number={1} title="Přihlaste se svým pracovním e-mailem">Na stránce <strong>/login</strong> zadejte e-mail a osmimístný kód, který přijde do schránky.</Step>
                    <Step number={2} title="Otevřete správnou část"><strong>Administrace</strong> slouží pro členy, pobočky a role. <strong>Pracovní prostor</strong> obsahuje partnery, nabídky, kampaně a schvalování.</Step>
                    <Step number={3} title="Zkontrolujte rozsah práce">V pracovním prostoru vyberte <strong>Národní</strong>, nebo <strong>Lokální</strong> a konkrétní pobočku.</Step>
                  </ul>
                </div>
                <div className="rounded-xl bg-[#f6f8fb] p-5">
                  <p className="text-sm font-bold text-[#12385b]">Dvě hlavní části</p>
                  <div className="mt-4 space-y-3">
                    <div className="flex gap-3 rounded-lg bg-white p-4"><ShieldCheck className="h-5 w-5 shrink-0 text-[#1d4f7d]" /><div><strong className="text-sm">Administrace</strong><p className="mt-1 text-xs leading-5 text-[#536273]">Členové, import, pobočky a přístupové role.</p></div></div>
                    <div className="flex gap-3 rounded-lg bg-white p-4"><Store className="h-5 w-5 shrink-0 text-[#1d4f7d]" /><div><strong className="text-sm">Pracovní prostor</strong><p className="mt-1 text-xs leading-5 text-[#536273]">Partneři, nabídky, hlášení, kampaně, události a metriky.</p></div></div>
                  </div>
                </div>
              </div>
            </GuideArticle>}

            {visibleIds.has('clenove') && <GuideArticle id="clenove" eyebrow="Administrace" title="Přidání a úprava členů">
              <MembersPreview />
              <div className="mt-8 grid gap-7 lg:grid-cols-2">
                <div><h3 className="text-lg font-bold">Přidat jednoho člena</h3><ol className="mt-4 space-y-4"><Step number={1} title="Otevřete Členové">V administraci ponechte vybranou záložku <strong>Členové</strong>.</Step><Step number={2} title="Vyplňte údaje">Zadejte e-mail, celé jméno, pobočku a datum platnosti členství.</Step><Step number={3} title="Klikněte na Uložit člena">Aplikace potvrdí, že byl člen přidán. Teprve potom se může přihlásit.</Step></ol></div>
                <div><h3 className="text-lg font-bold">Upravit existujícího člena</h3><ol className="mt-4 space-y-4"><Step number={1} title="Najděte člena">Použijte pole <strong>Hledat</strong>. Stačí část jména nebo e-mailu.</Step><Step number={2} title="Otevřete úpravu">U člena zvolte upravit a změňte jen potřebné údaje.</Step><Step number={3} title="Zkontrolujte stav">Pro běžný přístup musí být stav <strong>Aktivní</strong> a datum členství nesmí být v minulosti.</Step></ol></div>
              </div>
              <div className="mt-7"><Callout tone="warning"><strong>Pozor:</strong> deaktivace člena mu znemožní další přihlášení. Před uložením vždy zkontrolujte správný e-mail.</Callout></div>
              <div className="mt-7 rounded-xl border border-[#dde7f0] bg-[#f8fafc] p-5"><div className="flex items-start gap-3"><FileSpreadsheet className="mt-0.5 h-6 w-6 shrink-0 text-[#1d4f7d]" /><div><h3 className="font-bold">Více členů najednou pomocí CSV</h3><p className="mt-1 text-sm leading-6 text-[#536273]">Použijte <strong>Import CSV</strong>. Nejprve se zobrazí kontrolní náhled s chybami a duplicitami. Samotný soubor se po zpracování neukládá.</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[#1d4f7d]"><span className="rounded-md bg-[#eaf5ff] px-2 py-1">email</span><span className="rounded-md bg-[#eaf5ff] px-2 py-1">fullName</span><span className="rounded-md bg-[#eaf5ff] px-2 py-1">branch</span><span className="rounded-md bg-[#eaf5ff] px-2 py-1">membershipUntil</span></div></div></div></div>
            </GuideArticle>}

            {visibleIds.has('role') && <GuideArticle id="role" eyebrow="Bezpečný přístup" title="Role a oprávnění bez zmatku">
              <p className="max-w-3xl leading-7 text-[#536273]">Role určují, co člověk smí dělat. Rozsah určuje, kde to smí dělat. Vždy přidělte nejmenší oprávnění, které pro práci stačí.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[['Podpora', 'Vidí omezený stav účtu, ne historii QR.'], ['Koordinátor', 'Pracuje jen ve své oblasti, například partneři nebo akce.'], ['Manažer', 'Řídí běžný provoz v přiděleném rozsahu.'], ['Board', 'Schvaluje, spravuje členství a citlivé žádosti.'], ['Admin', 'Technická a přístupová administrace.']].map(([name, description]) => <div key={name} className="rounded-lg border border-[#dde7f0] p-4"><KeyRound className="h-5 w-5 text-[#1d4f7d]" /><h3 className="mt-3 font-bold">{name}</h3><p className="mt-1 text-sm leading-6 text-[#536273]">{description}</p></div>)}
              </div>
              <ol className="mt-7 space-y-4"><Step number={1} title="Otevřete záložku Role">Vyberte člověka podle členského přístupu.</Step><Step number={2} title="Vyberte typ práce">Zvolte preset, například Koordinátor partnerství nebo Manažer.</Step><Step number={3} title="Nastavte rozsah">Celostátní oprávnění platí všude. Lokální oprávnění musí mít konkrétní pobočku.</Step><Step number={4} title="Uveďte důvod a uložte">Důvod pomáhá později poznat, proč byl přístup přidělen.</Step></ol>
              <div className="mt-7"><Callout tone="warning">Nepřidělujte roli <strong>Admin</strong> jen proto, že člověk něco nevidí. Nejdřív ověřte jeho konkrétní roli, platnost a pobočku.</Callout></div>
            </GuideArticle>}

            {visibleIds.has('partneri') && <GuideArticle id="partneri" eyebrow="Pracovní prostor" title="Partner a nabídka od návrhu po zveřejnění">
              <OffersPreview />
              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <div><h3 className="text-lg font-bold">Nejdřív partner</h3><ol className="mt-4 space-y-4"><Step number={1} title="Vyberte Národní nebo Lokální">U lokálního partnera vyberte správnou pobočku.</Step><Step number={2} title="Otevřete Partneři">Vyplňte název, kategorii, web, adresu a krátký popis.</Step><Step number={3} title="Uložte partnera">Partner se pak objeví ve výběru při tvorbě nabídky.</Step></ol></div>
                <div><h3 className="text-lg font-bold">Potom nabídka</h3><ol className="mt-4 space-y-4"><Step number={1} title="Otevřete Nabídky">Vyberte partnera a popište výhodu tak, aby jí člen rozuměl.</Step><Step number={2} title="Doplňte podmínky a platnost">Zkontrolujte hodnotu, způsob uplatnění a datum konce.</Step><Step number={3} title="Odešlete ke schválení">Uložený koncept ještě členové nevidí. Použijte tlačítko <strong>Ke schválení</strong>.</Step></ol></div>
              </div>
              <div className="mt-7"><Callout tone="success"><strong>Dobrá nabídka odpoví na čtyři otázky:</strong> co člen získá, kde to platí, jak výhodu uplatní a dokdy platí.</Callout></div>
            </GuideArticle>}

            {visibleIds.has('schvaleni') && <GuideArticle id="schvaleni" eyebrow="Kontrola před publikací" title="Jak bezpečně schválit nabídku">
              <div className="grid gap-7 lg:grid-cols-[1fr_0.85fr]">
                <ol className="space-y-4"><Step number={1} title="Otevřete Schválení">Uvidíte nabídky, které někdo poslal ke kontrole.</Step><Step number={2} title="Ověřte partnera a podmínky">Zkontrolujte název, hodnotu, platnost, rozsah i způsob uplatnění.</Step><Step number={3} title="Publikujte nebo vraťte">Tlačítko <strong>Publikovat</strong> nabídku zpřístupní členům. <strong>Vrátit</strong> ji pošle zpět k doplnění.</Step></ol>
                <div className="rounded-xl border border-[#dde7f0] bg-[#f6f8fb] p-5"><div className="rounded-lg border border-[#dde7f0] bg-white p-4"><div className="flex items-start gap-3"><ClipboardCheck className="h-5 w-5 shrink-0 text-[#1d4f7d]" /><div><p className="font-bold">15 % na kávu</p><p className="mt-1 text-sm text-[#536273]">Kavárna U Mostu · připravila Jana</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><span className="rounded-lg border border-[#dde7f0] py-2 text-center text-sm font-bold text-[#b91c1c]">Vrátit</span><span className="rounded-lg bg-[#1d4f7d] py-2 text-center text-sm font-bold text-white">Publikovat</span></div></div><p className="mt-4 text-xs leading-5 text-[#536273]"><Flag className="mr-1 inline h-4 w-4 text-[#b66a00]" /> Pokud si nejste jistí podmínkami partnera, nabídku raději vraťte k doplnění.</p></div>
              </div>
            </GuideArticle>}

            {visibleIds.has('potize') && <GuideArticle id="potize" eyebrow="První pomoc" title="Když něco nefunguje">
              <div className="grid gap-3 lg:grid-cols-2">
                {[['Nepřišel přihlašovací kód', ['Zkontrolujte správnost e-mailu a složku Spam.', 'Ověřte, že má člověk aktivní členství.', 'Počkejte chvíli a zkuste nový kód.']], ['Člověk nevidí očekávanou záložku', ['Zkontrolujte jeho roli a platnost oprávnění.', 'Ověřte Národní/Lokální rozsah a pobočku.', 'Nepřidávejte automaticky roli Admin.']], ['Nabídka není vidět členům', ['Musí být publikovaná, ne jen uložená jako koncept.', 'Zkontrolujte datum platnosti.', 'U lokální nabídky ověřte pobočku člena.']], ['QR kód nejde ověřit', ['Kód platí pouze tři minuty.', 'Zkuste ručně zadat osmimístný kód.', 'Ověřte, že nabídka i členství jsou aktivní.']]].map(([title, items]) => <details key={title as string} className="group rounded-lg border border-[#dde7f0] bg-white p-4 open:bg-[#fafdff]"><summary className="flex cursor-pointer list-none items-center gap-3 font-bold"><CircleHelp className="h-5 w-5 shrink-0 text-[#1d4f7d]" /><span className="flex-1">{title as string}</span><ChevronRight className="h-5 w-5 text-[#738094] transition-transform group-open:rotate-90" /></summary><ul className="ml-8 mt-3 space-y-2 text-sm leading-6 text-[#536273]">{(items as string[]).map((item) => <li key={item} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-[#047857]" />{item}</li>)}</ul></details>)}
              </div>
              <div className="mt-7"><Callout tone="warning"><strong>Bezpečnostní incident nebo podezření na únik dat:</strong> nepokoušejte se problém řešit hromadným mazáním. Omezte přístup a ihned kontaktujte board a technického správce.</Callout></div>
            </GuideArticle>}
          </div>

          <footer className="mt-8 rounded-xl border border-[#dde7f0] bg-white p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div><p className="font-bold text-[#12385b]">Nenašli jste odpověď?</p><p className="mt-1 text-sm text-[#536273]">Popište, na jaké stránce jste a co jste očekávali. Neposílejte OTP kód ani osobní údaje členů.</p></div>
            <Link href="/privacy" className="mt-4 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-[#dde7f0] px-4 text-sm font-bold text-[#1d4f7d] sm:mt-0"><BadgeCheck className="h-4 w-4" /> Ochrana soukromí</Link>
          </footer>
        </div>
      </div>
    </main>
  );
}
