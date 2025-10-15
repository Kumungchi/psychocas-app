'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { defaultLocale, supportedLocales, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/strings';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

function resolveTranslation(dictionary: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = dictionary;
  for (const key of keys) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return path;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : path;
}

interface LocaleProviderProps {
  children: ReactNode;
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  const value = useMemo<LocaleContextValue>(() => {
    const dictionary = getDictionary(locale);
    return {
      locale,
      setLocale: (next) => {
        if (!supportedLocales.includes(next)) {
          return;
        }
        setLocale(next);
      },
      t: (path: string) => resolveTranslation(dictionary, path),
    };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export default function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}
