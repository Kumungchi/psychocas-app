import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import manifest from '@/app/manifest';

const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');

function readTextFile(filePath: string): string {
  if (!existsSync(filePath)) {
    throw new Error(`Expected file to exist: ${filePath}`);
  }

  return readFileSync(filePath, 'utf8');
}

function readPngDimensions(filePath: string): { width: number; height: number } {
  const bytes = readFileSync(filePath);
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe('PWA build artifacts', () => {
  it('exposes a web app manifest with required metadata', () => {
    const metadata = manifest();

    expect(metadata.id).toBe('/');
    expect(metadata.name).toBeDefined();
    expect(metadata.short_name).toBeDefined();
    expect(metadata.start_url).toBe('/home?source=pwa');
    expect(metadata.display).toBe('standalone');
    expect(metadata.background_color).toBeTruthy();
    expect(metadata.theme_color).toBeTruthy();

    const icons = metadata.icons ?? [];
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
    expect(readPngDimensions(path.join(publicDir, 'faviconV1.png'))).toEqual({ width: 192, height: 192 });
    expect(readPngDimensions(path.join(publicDir, 'faviconV2.png'))).toEqual({ width: 512, height: 512 });
    expect(readPngDimensions(path.join(publicDir, 'icon-maskable-512.png'))).toEqual({ width: 512, height: 512 });
  });

  it('ships a controlled service worker with safe cache boundaries', () => {
    const serviceWorkerPath = path.join(publicDir, 'sw.js');
    const serviceWorker = readTextFile(serviceWorkerPath);

    expect(serviceWorker).toContain('offline.html');
    expect(serviceWorker).toContain("event.data?.type === 'SKIP_WAITING'");
    expect(serviceWorker).toContain('NETWORK_ONLY_PREFIXES');
    expect(serviceWorker).toContain("'/v'");
    expect(serviceWorker).toContain("'/workspace'");
    expect(serviceWorker).toContain('/api/auth');
    expect(serviceWorker).toContain("request.mode === 'navigate'");
    expect(serviceWorker).toContain("fetch(request, { cache: 'no-store' })");
    expect(serviceWorker).not.toContain('precacheAndRoute');
    expect(serviceWorker).not.toContain('workbox-');
  });

  it('does not ship stale Workbox or generated fallback bundles', () => {
    const publicFiles = readdirSync(publicDir);
    const fallbackBundles = publicFiles.filter((file) => /^fallback-[\w-]+\.js$/.test(file));
    const workboxBundles = publicFiles.filter((file) => /^workbox-[\w-]+\.js$/.test(file));

    expect(fallbackBundles).toEqual([]);
    expect(workboxBundles).toEqual([]);

    const offlineHtml = readTextFile(path.join(publicDir, 'offline.html'));
    expect(offlineHtml).toContain('Offline režim');
    expect(offlineHtml).toContain('Offline mode');
    expect(offlineHtml).toContain('One-time-code sign-in requires a connection');
  });
});
