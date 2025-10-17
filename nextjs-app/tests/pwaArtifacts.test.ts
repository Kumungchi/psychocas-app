import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');

function readTextFile(filePath: string): string {
  if (!existsSync(filePath)) {
    throw new Error(`Expected file to exist: ${filePath}`);
  }

  return readFileSync(filePath, 'utf8');
}

describe('PWA build artifacts', () => {
  it('exposes a web app manifest with required metadata', () => {
    const manifestPath = path.join(publicDir, 'manifest.json');
    const manifestContent = readTextFile(manifestPath);
    const manifest = JSON.parse(manifestContent) as {
      name?: string;
      short_name?: string;
      start_url?: string;
      display?: string;
      icons?: Array<{ src?: string; sizes?: string; type?: string; purpose?: string }>;
      background_color?: string;
      theme_color?: string;
    };

    expect(manifest.name).toBeDefined();
    expect(manifest.short_name).toBeDefined();
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBeTruthy();
    expect(manifest.theme_color).toBeTruthy();

    const icons = manifest.icons ?? [];
    expect(icons.length).toBeGreaterThanOrEqual(2);
    expect(icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: expect.stringContaining('faviconV1'),
          sizes: '192x192',
          type: 'image/png',
        }),
        expect.objectContaining({
          src: expect.stringContaining('faviconV2'),
          sizes: '512x512',
          type: 'image/png',
        }),
      ]),
    );
    expect(icons.some((icon) => icon.purpose?.includes('maskable'))).toBe(true);
  });

  it('generates a service worker with offline fallbacks', () => {
    const serviceWorkerPath = path.join(publicDir, 'sw.js');
    const serviceWorker = readTextFile(serviceWorkerPath);

    expect(serviceWorker).toContain('precacheAndRoute');
    expect(serviceWorker).toContain('offline.html');
    expect(serviceWorker).toContain('workbox-');
    expect(serviceWorker).toContain('skipWaiting');
  });

  it('ships fallback bundles alongside the offline document', () => {
    const publicFiles = readdirSync(publicDir);
    const fallbackBundles = publicFiles.filter((file) => /^fallback-[\w-]+\.js$/.test(file));

    expect(fallbackBundles.length).toBeGreaterThan(0);

    for (const bundle of fallbackBundles) {
      const bundleContent = readTextFile(path.join(publicDir, bundle));
      expect(bundleContent.length).toBeGreaterThan(0);
    }

    const offlineHtml = readTextFile(path.join(publicDir, 'offline.html'));
    expect(offlineHtml).toContain('Offline režim');
  });
});
