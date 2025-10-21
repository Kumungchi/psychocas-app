import { describe, expect, it } from 'vitest';
import { dictionaries } from '@/lib/i18n/strings';
import { asTranslationKey, resolveTranslatable, formatTemplate } from '@/lib/i18n/utils';

type Dictionary = Record<string, unknown>;

function collectTranslationPaths(dictionary: Dictionary, prefix = ''): string[] {
  return Object.entries(dictionary).flatMap(([key, value]) => {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return collectTranslationPaths(value as Dictionary, nextPath);
    }
    return [nextPath];
  });
}

function getTranslation(dictionary: Dictionary, path: string): string | undefined {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (!acc || typeof acc !== 'object') {
      return undefined;
    }
    return (acc as Dictionary)[segment];
  }, dictionary) as string | undefined;
}

describe('i18n dictionaries', () => {
  it('expose the same translation keys for Czech and English', () => {
    const csPaths = collectTranslationPaths(dictionaries.cs);
    const enPaths = collectTranslationPaths(dictionaries.en);

    expect(enPaths.sort()).toEqual(csPaths.sort());
  });

  it('resolves translation keys against the active dictionary', () => {
    const samplePath = 'home.refresh';
    const translationKey = asTranslationKey(samplePath);
    const csValue = getTranslation(dictionaries.cs, samplePath);
    const enValue = getTranslation(dictionaries.en, samplePath);

    expect(csValue).toBeDefined();
    expect(enValue).toBeDefined();
    expect(csValue).not.toBe(enValue);

    const resolved = resolveTranslatable(translationKey, (key) => getTranslation(dictionaries.en, key) ?? key);
    expect(resolved).toBe(enValue);
  });

  it('returns the original value when no translation key is provided', () => {
    expect(resolveTranslatable('Plain text', () => 'unused')).toBe('Plain text');
    expect(resolveTranslatable(null, () => 'unused')).toBeNull();
    expect(resolveTranslatable(undefined, () => 'unused')).toBeNull();
  });

  it('replaces placeholders when formatting translated messages', () => {
    const template = getTranslation(dictionaries.en, 'home.refreshStatus.success');
    expect(template).toBeDefined();

    const formatted = formatTemplate(template!, { timestamp: 'January 1, 2025' });
    expect(formatted).toContain('January 1, 2025');
  });
});
