'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useLocale from '@/hooks/useLocale';
import PsychocasLogo from '@/components/PsychocasLogo';

export default function RootPage() {
  const router = useRouter();
  const { t } = useLocale();

  useEffect(() => {
    router.push('/login');
  }, [router]);

  return (
    <main className="psychocas-section flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="auth-shell fade-in-up">
        <section className="psychocas-card auth-card auth-shell__card auth-shell__card--compact" aria-labelledby="root-title">
          <div className="auth-shell__header">
            <PsychocasLogo size={100} gradientId="rootLogoGradient" />
            <div>
              <h1 id="root-title" className="auth-shell__title">
                Psychočas
              </h1>
              <p className="auth-shell__subtitle">{t('root.redirecting')}</p>
            </div>
          </div>

          <p className="auth-shell__footnote">{t('login.subtitlePrompt')}</p>
        </section>

        <aside className="auth-shell__hero" aria-hidden="true">
          <div className="space-y-6">
            <PsychocasLogo size={140} gradientId="rootHeroGradient" />
            <h2 className="auth-shell__hero-title">{t('login.title')}</h2>
            <p className="auth-shell__hero-text">{t('login.subtitlePrompt')}</p>
          </div>

          <div className="auth-shell__divider" />

          <p className="auth-shell__footnote">{t('login.helpText')}</p>
        </aside>
      </div>
    </main>
  );
}
