'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, BarChart3, BadgeCheck, Settings } from 'lucide-react';
import PsychocasLogo from '@/components/PsychocasLogo';
import Button from '@/ui/components/Button';
import Badge from '@/ui/components/Badge';
import type { MemberRole } from '@/types/member';

interface DemoCard {
  role: MemberRole;
  title: string;
  description: string;
  icon: typeof BadgeCheck;
}

const demoCards: DemoCard[] = [
  {
    role: 'member',
    title: 'Členský pohled',
    description: 'Digitální členství, jednorázový QR kód, výhody, události a profil.',
    icon: BadgeCheck,
  },
  {
    role: 'manager',
    title: 'Manažer pobočky',
    description: 'Lokální správa partnerů, událostí, check-inu a agregovaných metrik.',
    icon: BarChart3,
  },
  {
    role: 'board',
    title: 'Board a admin',
    description: 'Schvalování, hromadná správa členství, přístupy a privacy požadavky.',
    icon: Settings,
  },
];

export default function DemoPage() {
  const router = useRouter();

  const openDemo = (card: DemoCard) => {
    router.push(`/demo/${card.role}`);
  };

  return (
    <main className="min-h-screen bg-[#f6f8fb] px-4 py-6 text-[#172033] sm:px-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-5 rounded-lg border border-[#dfe8f1] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <PsychocasLogo size={58} gradientId="demoHubLogo" />
            <div>
              <Badge tone="info">Demo hub</Badge>
              <h1 className="mt-2 text-2xl font-semibold text-[#12385b]">
                Psychočas MVP ukázka
              </h1>
              <p className="mt-1 text-sm text-[#536273]">
                Vyberte roli a otevřete připravený náhled bez produkčního přihlášení.
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" onClick={() => router.push('/')}>
            Zpět na pitch
          </Button>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {demoCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.role}
                type="button"
                onClick={() => openDemo(card)}
                className="rounded-lg border border-[#dfe8f1] bg-white p-5 text-left shadow-sm transition hover:border-[#bcd4ea] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#049edb]"
              >
                <Icon className="h-6 w-6 text-[#1d4f7d]" aria-hidden />
                <h2 className="mt-4 text-lg font-semibold text-[#172033]">{card.title}</h2>
                <p className="mt-2 min-h-16 text-sm leading-6 text-[#536273]">
                  {card.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#1d4f7d]">
                  Otevřít demo
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </button>
            );
          })}
        </section>
      </div>
    </main>
  );
}
