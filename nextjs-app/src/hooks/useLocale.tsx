'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { defaultLocale, supportedLocales, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/strings';
import { formatTemplate, type TranslateFn } from '@/lib/i18n/utils';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
  formatMessage: (path: string, vars: Record<string, string | number>) => string;
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

const STORAGE_KEY = 'psychocas.locale';

export function LocaleProvider({ children }: LocaleProviderProps) {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage?.getItem(STORAGE_KEY);
      if (stored && supportedLocales.includes(stored as Locale)) {
        return stored as Locale;
      }
    }
    return defaultLocale;
  });

  const value = useMemo<LocaleContextValue>(() => {
    const dictionary = getDictionary(locale);
    const translate: TranslateFn = (path: string) => resolveTranslation(dictionary, path);
    return {
      locale,
      setLocale: (next) => {
        if (!supportedLocales.includes(next)) {
          return;
        }
        setLocale(next);
        if (typeof window !== 'undefined') {
          window.localStorage?.setItem(STORAGE_KEY, next);
        }
      },
      t: translate,
      formatMessage: (path, vars) => formatTemplate(translate(path), vars),
    };
  }, [locale]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
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
