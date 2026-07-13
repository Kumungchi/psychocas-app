'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  MessageSquareText,
  QrCode,
  Smartphone,
  Store,
} from 'lucide-react';
import PsychocasLogo from '@/components/PsychocasLogo';
import useLocale from '@/hooks/useLocale';
import Button from '@/ui/components/Button';
import Badge from '@/ui/components/Badge';
import type { MemberRole } from '@/types/member';

interface DemoOption {
  role: MemberRole;
  label: string;
  description: string;
}

const demoOptions: DemoOption[] = [
  {
    role: 'member',
    label: 'Členský pohled',
    description: 'Členství, QR, výhody, události a profil.',
  },
  {
    role: 'manager',
    label: 'Statistiky',
    description: 'Lokální správa, události a anonymní metriky.',
  },
  {
    role: 'board',
    label: 'Správa',
    description: 'Schválení, členství, přístupy a privacy fronta.',
  },
];

const features = [
  {
    icon: BadgeCheck,
    title: 'Digitální členství',
    text: 'Jasný stav členství, platnost a lokální pobočka v mobilu.',
  },
  {
    icon: QrCode,
    title: 'Krátkodobý kód',
    text: 'Člen u partnera ukáže kód nebo QR, který je platný jen omezenou dobu.',
  },
  {
    icon: Store,
    title: 'Partner bez zmatku',
    text: 'Obsluha rychle ověří nárok a nemusí řešit ruční seznamy.',
  },
  {
    icon: BarChart3,
    title: 'Data pro rozvoj',
    text: 'Tým vidí, které benefity fungují a kde má smysl shánět partnery.',
  },
];

const roadmap = [
  'stabilní PWA instalace a offline náhled posledních dat',
  'správa partnerů, slev a dočasných přístupů přímo v aplikaci',
  'sběr zpětné vazby od členů: co chtějí používat a kde chybí partneři',
];

export default function RootPage() {
  const router = useRouter();
  const { tr } = useLocale();

  const openDemo = (option: DemoOption) => {
    router.push(`/demo/${option.role}`);
  };

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-[#172033]">
      <section className="mx-auto grid min-h-[92vh] w-full max-w-6xl grid-rows-[auto_1fr] px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 py-2">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="flex items-center gap-3 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#049edb]"
            aria-label={tr('Psychočas úvod')}
          >
            <PsychocasLogo size={46} gradientId="landingLogo" />
            <div>
              <p className="text-sm font-semibold text-[#1d4f7d]">Psychočas</p>
              <p className="text-xs text-[#607086]">{tr('členská aplikace')}</p>
            </div>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push('/login')}
          >
            {tr('Přihlášení')}
          </Button>
        </header>

        <div className="grid items-center gap-8 py-8 lg:grid-cols-[1fr_0.82fr] lg:py-10">
          <div className="max-w-2xl space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">{tr('MVP pro ukázku')}</Badge>
              <Badge tone="neutral">{tr('feedback vítán')}</Badge>
            </div>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-[2.35rem] font-semibold leading-tight text-[#12385b] sm:text-5xl">
                {tr('Členství, slevy a zpětná vazba v jedné mobilní aplikaci.')}
              </h1>
              <p className="max-w-xl text-base leading-7 text-[#536273] sm:text-lg">
                {tr('Psychočas dává členům jednoduchý digitální průkaz, partnerům rychlé ověření a týmu data, podle kterých půjde rozvíjet benefity, které lidé opravdu využijí.')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {demoOptions.map((option) => (
                <button
                  key={option.role}
                  type="button"
                  onClick={() => openDemo(option)}
                  className="group rounded-lg border border-[#d8e5ef] bg-white p-4 text-left shadow-sm transition hover:border-[#9bc7e3] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#049edb]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-[#12385b]">{tr(option.label)}</span>
                    <ArrowRight className="h-4 w-4 text-[#1d4f7d] transition group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-2 text-sm leading-5 text-[#607086]">{tr(option.description)}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm">
            <div className="rounded-[1.8rem] border border-[#d9e4ef] bg-[#172033] p-3 shadow-2xl">
              <div className="rounded-[1.25rem] bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PsychocasLogo size={38} gradientId="phoneLogo" />
                    <div>
                      <p className="text-sm font-semibold text-[#12385b]">{tr('Demo Člen')}</p>
                      <p className="text-xs text-[#738094]">Praha</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#DFF4FF] px-2.5 py-1 text-xs font-bold uppercase text-[#1d4f7d]">
                    {tr('aktivní')}
                  </span>
                </div>
                <div className="rounded-lg border border-[#c8dff5] bg-[#eaf5ff] p-4">
                  <p className="text-xs font-semibold uppercase text-[#1d4f7d]">
                    {tr('Digitální karta')}
                  </p>
                  <p className="mt-3 font-mono text-2xl font-semibold tracking-[0.14em] text-[#12385b]">
                    PSYCH-D3M0X7
                  </p>
                  <div className="mt-4 flex items-center justify-between text-sm text-[#1d4f7d]">
                    <span>02:48</span>
                    <span>{tr('QR připraven')}</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-lg border border-[#e5eaf0] p-3">
                    <p className="text-xs font-semibold uppercase text-[#607086]">
                      {tr('Partnerství')}
                    </p>
                    <p className="mt-1 text-sm text-[#172033]">
                      {tr('Celostátní i lokální výhody podle pobočky.')}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#e5eaf0] p-3">
                    <p className="text-xs font-semibold uppercase text-[#607086]">
                      {tr('Offline režim')}
                    </p>
                    <p className="mt-1 text-sm text-[#172033]">
                      {tr('Poslední stav zůstane dostupný i bez připojení.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#dde7f0] bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-lg border border-[#e4ebf2] p-4">
                <Icon className="h-5 w-5 text-[#1d4f7d]" aria-hidden />
                <h2 className="mt-3 text-base font-semibold text-[#172033]">{tr(feature.title)}</h2>
                <p className="mt-2 text-sm leading-6 text-[#536273]">{tr(feature.text)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1fr] lg:px-8">
        <div>
          <h2 className="text-2xl font-semibold text-[#12385b]">{tr('Proč aplikace existuje')}</h2>
          <p className="mt-3 leading-7 text-[#536273]">
            {tr('Chceme, aby členství mělo viditelnou hodnotu každý týden, ne jen v registračním e-mailu. MVP má ukázat základní tok a otevřít debatu o tom, co členové i pobočky reálně potřebují.')}
          </p>
        </div>
        <div className="rounded-lg border border-[#e4ebf2] bg-white p-5">
          <div className="flex items-start gap-3">
            <MessageSquareText className="mt-1 h-5 w-5 text-[#1d4f7d]" aria-hidden />
            <div>
              <h3 className="text-lg font-semibold text-[#172033]">{tr('Co chceme zjistit feedbackem')}</h3>
              <p className="mt-2 text-sm leading-6 text-[#536273]">
                {tr('Které funkce mají největší smysl, jaké slevy lidé opravdu využijí, kde chybí partneři a jak má vypadat správa pro pobočky.')}
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-[#536273]">
            {roadmap.map((item) => (
              <li key={item} className="flex gap-2">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-[#049edb]" aria-hidden />
                <span>{tr(item)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
