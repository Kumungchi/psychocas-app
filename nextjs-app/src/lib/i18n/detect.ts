import { defaultLocale, supportedLocales, type Locale } from './config';

const NORMALISE_SEPARATOR = '-';

const normaliseCandidate = (value: string): string => {
  const lowerCased = value.toLowerCase();
  const [base] = lowerCased.split(NORMALISE_SEPARATOR);
  return base ?? lowerCased;
};

export const resolveLocaleFromHeader = (headerValue: string | null): Locale => {
  if (!headerValue) {
    return defaultLocale;
  }

  const candidates = headerValue
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split(';')[0])
    .filter(Boolean);

  for (const candidate of candidates) {
    const normalised = normaliseCandidate(candidate);
    if (supportedLocales.includes(normalised as Locale)) {
      return normalised as Locale;
    }
  }

  return defaultLocale;
};
