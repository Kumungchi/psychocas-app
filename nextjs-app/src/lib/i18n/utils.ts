import type { Locale } from './config';

export const TRANSLATION_PREFIX = '__i18n__:';

export const asTranslationKey = (key: string) => `${TRANSLATION_PREFIX}${key}`;

export type TranslateFn = (path: string) => string;

export const resolveTranslatable = (
  value: string | null | undefined,
  t: TranslateFn
): string | null => {
  if (value == null) {
    return value ?? null;
  }
  return value.startsWith(TRANSLATION_PREFIX) ? t(value.slice(TRANSLATION_PREFIX.length)) : value;
};

export const formatTemplate = (
  template: string,
  vars: Record<string, string | number>
): string => {
  let output = template;
  for (const [token, value] of Object.entries(vars)) {
    output = output.replace(new RegExp(`\\{${token}\\}`, 'g'), String(value));
  }
  return output;
};

export const formatTranslation = (
  t: TranslateFn,
  key: string,
  vars: Record<string, string | number>
): string => formatTemplate(t(key), vars);

export const getDateLocale = (locale: Locale): string => (locale === 'cs' ? 'cs-CZ' : 'en-US');
