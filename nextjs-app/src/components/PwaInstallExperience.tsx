'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Download,
  EllipsisVertical,
  Maximize2,
  Share2,
  Smartphone,
  SquarePlus,
  X,
  type LucideIcon,
} from 'lucide-react';
import useLocale from '@/hooks/useLocale';
import usePwaInstallPrompt from '@/hooks/usePwaInstallPrompt';
import {
  shouldAutoOfferInstall,
  type InstallBrowser,
  type InstallPlatform,
} from '@/lib/pwa/installOffer';
import Button, { type ButtonProps } from '@/ui/components/Button';
import { colors, radii, shadows } from '@/ui/theme';

const DISMISSED_STORAGE_KEY = 'psychocas.pwa-install-dismissed-at';

interface PwaInstallExperienceProps {
  autoOffer?: boolean;
  triggerVariant?: NonNullable<ButtonProps['variant']>;
  triggerSize?: NonNullable<ButtonProps['size']>;
  triggerClassName?: string;
}

interface InstructionStep {
  icon: LucideIcon;
  text: string;
}

const browserGuide: Record<InstallBrowser, { heading: string; share: string; menu: string }> = {
  safari: {
    heading: 'Jak nainstalovat v Safari',
    share: 'V Safari klepni na Sdílet.',
    menu: 'V Safari otevři nabídku Sdílet.',
  },
  chrome: {
    heading: 'Jak nainstalovat v Chromu',
    share: 'V Chromu klepni na Sdílet.',
    menu: 'V Chromu otevři nabídku se třemi tečkami.',
  },
  edge: {
    heading: 'Jak nainstalovat v Microsoft Edge',
    share: 'V Microsoft Edge klepni na Sdílet.',
    menu: 'V Microsoft Edge otevři nabídku prohlížeče.',
  },
  firefox: {
    heading: 'Jak nainstalovat ve Firefoxu',
    share: 'Ve Firefoxu klepni na Sdílet.',
    menu: 'Ve Firefoxu otevři nabídku prohlížeče.',
  },
  samsung: {
    heading: 'Jak nainstalovat v Samsung Internet',
    share: 'V Samsung Internet klepni na Sdílet.',
    menu: 'V Samsung Internet otevři nabídku prohlížeče.',
  },
  other: {
    heading: 'Jak nainstalovat v tomto prohlížeči',
    share: 'Klepni na Sdílet v nabídce prohlížeče.',
    menu: 'Otevři nabídku prohlížeče.',
  },
};

function installationSteps(platform: InstallPlatform, browser: InstallBrowser): InstructionStep[] {
  if (platform === 'ios') {
    return [
      { icon: Share2, text: browserGuide[browser].share },
      { icon: SquarePlus, text: 'Vyber Přidat na domovskou obrazovku.' },
      { icon: CheckCircle2, text: 'Potvrď tlačítkem Přidat.' },
    ];
  }

  return [
    { icon: EllipsisVertical, text: browserGuide[browser].menu },
    { icon: SquarePlus, text: 'Vyber Nainstalovat aplikaci nebo přidání na domovskou obrazovku.' },
    { icon: CheckCircle2, text: 'Potvrď instalaci.' },
  ];
}

export default function PwaInstallExperience({
  autoOffer = false,
  triggerVariant = 'secondary',
  triggerSize = 'lg',
  triggerClassName,
}: PwaInstallExperienceProps) {
  const { tr } = useLocale();
  const { browser, canInstall, installed, isMobile, platform, ready, promptInstall } =
    usePwaInstallPrompt();
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const steps = useMemo(() => installationSteps(platform, browser), [browser, platform]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISSED_STORAGE_KEY, String(Date.now()));
    } catch {
      // The install flow still works when storage is unavailable.
    }
    setOpen(false);
    setMessage(null);
  }, []);

  useEffect(() => {
    if (!autoOffer || !ready) return;

    let dismissedAt: number | null = null;
    try {
      const stored = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
      dismissedAt = stored === null ? null : Number(stored);
    } catch {
      dismissedAt = null;
    }

    if (!shouldAutoOfferInstall({ isMobile, installed, dismissedAt })) return;
    const timer = window.setTimeout(() => setOpen(true), 1600);
    return () => window.clearTimeout(timer);
  }, [autoOffer, installed, isMobile, ready]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dismiss, open]);

  const openDialog = () => {
    setMessage(null);
    setOpen(true);
  };

  const install = async () => {
    setInstalling(true);
    const result = await promptInstall();
    setInstalling(false);

    if (result.outcome === 'accepted') {
      try {
        window.localStorage.removeItem(DISMISSED_STORAGE_KEY);
      } catch {
        // Installation does not depend on local storage cleanup.
      }
      setOpen(false);
      return;
    }

    if (result.outcome === 'dismissed') {
      setMessage('Instalace byla zrušena. Můžeš ji spustit znovu.');
    }
  };

  if (installed) return null;

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        onClick={openDialog}
      >
        <Download className="h-5 w-5" aria-hidden />
        {tr('Nainstalovat aplikaci')}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-[#101b2b]/55 p-0 sm:items-center sm:p-4"
        >
          <section
            className="max-h-[88dvh] w-full overflow-y-auto rounded-t-lg border bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5 text-left sm:max-w-md sm:rounded-lg sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            style={{ borderColor: colors.border, boxShadow: shadows.md }}
          >
            <header className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center"
                  style={{ borderRadius: radii.md, background: colors.brandSurface, color: colors.brandPrimary }}
                >
                  <Smartphone className="h-6 w-6" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase" style={{ color: colors.brandPrimary }}>
                    Psychočas
                  </p>
                  <h2 id="pwa-install-title" className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
                    {tr('Nainstalovat Psychočas')}
                  </h2>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#049edb]"
                style={{ borderColor: colors.border, borderRadius: radii.md, color: colors.textSecondary }}
                aria-label={tr('Zavřít nabídku instalace')}
                onClick={dismiss}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </header>

            <p className="mt-4 text-sm leading-6" style={{ color: colors.textSecondary }}>
              {tr('Měj členský průkaz, výhody a události vždy po ruce přímo v mobilu.')}
            </p>

            {platform === 'ios' || !canInstall ? (
              <div className="mt-5">
                <h3 className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                  {tr(browserGuide[browser].heading)}
                </h3>
                <ol className="mt-3 space-y-3">
                  {steps.map(({ icon: Icon, text }, index) => (
                    <li key={text} className="flex items-center gap-3 text-sm" style={{ color: colors.textSecondary }}>
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center"
                        style={{ borderRadius: radii.md, background: colors.backgroundMuted, color: colors.brandPrimary }}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span>
                        <strong style={{ color: colors.textPrimary }}>{index + 1}.</strong> {tr(text)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <Button
                type="button"
                size="lg"
                block
                className="mt-5 min-h-12"
                disabled={installing}
                onClick={() => void install()}
              >
                <Download className="h-5 w-5" aria-hidden />
                {tr(installing ? 'Otevírám instalaci…' : 'Nainstalovat teď')}
              </Button>
            )}

            <ul
              className="mt-5 grid gap-2 border-t pt-4 text-sm"
              style={{ borderColor: colors.border, color: colors.textPrimary }}
            >
              {[
                { icon: Smartphone, text: 'Rychlý přístup přímo z mobilu' },
                { icon: Maximize2, text: 'Zobrazení bez adresního řádku' },
                { icon: BellRing, text: 'Push oznámení jen po tvém souhlasu' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" style={{ color: colors.brandPrimary }} aria-hidden />
                  <span>{tr(text)}</span>
                </li>
              ))}
            </ul>

            {message && (
              <p className="mt-4 text-sm font-medium" role="status" style={{ color: colors.warning }}>
                {tr(message)}
              </p>
            )}

            <p className="mt-5 border-t pt-4 text-xs leading-5" style={{ borderColor: colors.border, color: colors.textSecondary }}>
              {tr('Instalace je volitelná. Psychočas dál funguje i v prohlížeči.')}
            </p>
            <Button type="button" variant="ghost" block className="mt-3 min-h-11" onClick={dismiss}>
              {tr('Teď ne')}
            </Button>
          </section>
        </div>
      )}
    </>
  );
}
