'use client';

import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  BarChart3,
  LogIn,
  MessageSquareText,
  QrCode,
  ShieldCheck,
  Smartphone,
  Store,
} from 'lucide-react';
import PsychocasLogo from '@/components/PsychocasLogo';
import PwaInstallExperience from '@/components/PwaInstallExperience';
import useLocale from '@/hooks/useLocale';
import Button from '@/ui/components/Button';
import Badge from '@/ui/components/Badge';

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
  'instalace PWA na plochu a bezpečný stav při výpadku připojení',
  'správa partnerů, slev, událostí a přístupů přímo v aplikaci',
  'zpětná vazba a návrhy partnerů s dohledatelným schválením',
];

export default function RootPage() {
  const router = useRouter();
  const { tr } = useLocale();

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
              <Badge tone="info">{tr('Pilotní provoz')}</Badge>
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

            <div className="max-w-xl space-y-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <PwaInstallExperience
                  autoOffer
                  triggerVariant="primary"
                  triggerSize="lg"
                  triggerClassName="min-h-12 w-full"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="min-h-12 w-full"
                  onClick={() => router.push('/login')}
                >
                  <LogIn className="h-5 w-5" aria-hidden />
                  {tr('Přihlásit se do aplikace')}
                </Button>
              </div>
              <a
                href="/privacy"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#1d4f7d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#049edb]"
              >
                <ShieldCheck className="h-5 w-5" aria-hidden />
                {tr('Ochrana soukromí')}
              </a>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm">
            <div className="rounded-[1.8rem] border border-[#d9e4ef] bg-[#172033] p-3 shadow-2xl">
              <div className="rounded-[1.25rem] bg-white p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <PsychocasLogo size={38} gradientId="phoneLogo" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#12385b]">{tr('Členský průkaz')}</p>
                      <p className="text-xs text-[#738094]">{tr('Pobočka podle členství')}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#DFF4FF] px-2.5 py-1 text-xs font-bold uppercase text-[#1d4f7d]">
                    {tr('zabezpečeno')}
                  </span>
                </div>
                <div className="rounded-lg border border-[#c8dff5] bg-[#eaf5ff] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white text-[#12385b]">
                      <QrCode className="h-11 w-11" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#12385b]">
                        {tr('Jednorázový QR kód')}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#1d4f7d]">
                        {tr('Vytvoří se bezpečně až po přihlášení člena.')}
                      </p>
                    </div>
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
                      {tr('Aplikace oznámí výpadek a citlivá data neukládá do veřejné cache.')}
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
            {tr('Chceme, aby členství mělo viditelnou hodnotu každý týden, ne jen v registračním e-mailu. Pilot propojuje členy, pobočky a partnery a pomáhá ověřit, co lidé opravdu potřebují.')}
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
