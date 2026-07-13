import { chromium } from '@playwright/test';

const baseUrl = process.env.PSYCHOCAS_DEMO_BASE_URL ?? 'http://localhost:3000';
const testEmail = process.env.PSYCHOCAS_TEST_EMAIL?.trim();
const targetHostname = new URL(baseUrl).hostname;
const isLocalTarget = ['localhost', '127.0.0.1', '::1'].includes(targetHostname);

const routes = [
  { path: '/', width: 375, height: 667, text: 'Členství, slevy a zpětná vazba' },
  { path: '/demo/member', width: 360, height: 800, text: 'Digitální členství' },
  { path: '/demo/member', width: 430, height: 932, text: 'Aktuální výhody' },
  { path: '/demo/manager', width: 390, height: 844, text: 'Manažerský pohled' },
  { path: '/demo/board', width: 390, height: 844, text: 'Čeká na rozhodnutí' },
  { path: '/demo/board', width: 1280, height: 800, text: 'Privacy fronta' },
  { path: '/login', width: 390, height: 844, text: 'Přihlášení členů' },
  { path: '/privacy', width: 430, height: 932, text: 'Ochrana osobních údajů' },
  { path: '/v', width: 390, height: 844, text: 'Ověření členské výhody' },
] as const;

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'allow', locale: 'cs-CZ' });
  const page = await context.newPage();
  const errors: string[] = [];
  const results: Array<Record<string, unknown>> = [];

  if (isLocalTarget) {
    await context.route('**/qr/validate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Cache-Control': 'no-store' },
        body: JSON.stringify({ status: 'invalid', checkedAt: Date.now() }),
      });
    });
  }

  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    try {
      await page.reload({ waitUntil: 'networkidle' });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('ERR_ABORTED')) throw error;
      await page.waitForLoadState('domcontentloaded');
    }

    for (const route of routes) {
      await page.setViewportSize({ width: route.width, height: route.height });
      const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
      if (!response?.ok()) throw new Error(`${route.path} returned ${response?.status() ?? 'no response'}`);
      await page.getByText(route.text, { exact: false }).first().waitFor({ state: 'visible' });
      await page.waitForLoadState('networkidle');
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      if (layout.scrollWidth > layout.clientWidth + 1) {
        throw new Error(`${route.path} overflows horizontally at ${route.width}px`);
      }
      results.push({ route: route.path, viewport: `${route.width}x${route.height}`, ...layout });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Informace k přihlášení' }).click();
    await page.getByRole('dialog', { name: 'Informace k přihlášení' }).waitFor({ state: 'visible' });
    results.push({ check: 'login-info-dialog', status: 'visible' });

    if (testEmail) {
      await page.getByRole('button', { name: 'Zavřít informace' }).click();
      await page.getByLabel('Členský email').fill(testEmail);
      await page.getByRole('button', { name: 'Poslat přihlašovací kód' }).click();
      await page.getByText('Kód z emailu', { exact: true }).waitFor({ state: 'visible' });
      results.push({ check: 'otp-email-request', status: 'accepted' });
    }

    await page.goto(`${baseUrl}/v`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Osmimístný ověřovací kód').fill('ABCD2345');
    await page.getByRole('button', { name: 'Ověřit kód' }).click();
    await page.getByText('Kód není platný', { exact: true }).waitFor({ state: 'visible' });
    results.push({ check: 'public-qr-invalid-result', status: 'visible' });

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Přepnout aplikaci do angličtiny' }).click();
    await page
      .getByText('Membership, benefits, and feedback in one mobile app.', { exact: true })
      .waitFor({ state: 'visible' });
    const englishLocale = await page.evaluate(() => ({
      documentLanguage: document.documentElement.lang,
      savedLanguage: window.localStorage.getItem('psychocas.locale'),
    }));
    if (englishLocale.documentLanguage !== 'en' || englishLocale.savedLanguage !== 'en') {
      throw new Error(`English locale was not applied: ${JSON.stringify(englishLocale)}`);
    }

    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Member sign-in', { exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Sign-in information' }).click();
    await page.getByRole('dialog', { name: 'Sign-in information' }).waitFor({ state: 'visible' });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Member sign-in', { exact: true }).waitFor({ state: 'visible' });

    await page.goto(`${baseUrl}/v`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Member benefit verification', { exact: true }).waitFor({ state: 'visible' });
    await page.getByLabel('Eight-character verification code').fill('ABCD2345');
    await page.getByRole('button', { name: 'Verify code' }).click();
    await page.getByText('Invalid code', { exact: true }).waitFor({ state: 'visible' });
    results.push({ check: 'english-locale-auth-and-qr', status: 'persistent' });

    await page.getByRole('button', { name: 'Switch the app to Czech' }).click();
    await page.getByText('Ověření členské výhody', { exact: true }).waitFor({ state: 'visible' });
    const czechLocale = await page.evaluate(() => ({
      documentLanguage: document.documentElement.lang,
      savedLanguage: window.localStorage.getItem('psychocas.locale'),
    }));
    if (czechLocale.documentLanguage !== 'cs' || czechLocale.savedLanguage !== 'cs') {
      throw new Error(`Czech locale was not restored: ${JSON.stringify(czechLocale)}`);
    }
    results.push({ check: 'locale-switch-and-persistence', status: 'ok' });

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    const serviceWorker = await page.evaluate(async () => {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 10_000)),
      ]);
      return registration
        ? { active: registration.active?.state ?? null, scope: registration.scope }
        : { active: null, scope: null };
    });
    if (serviceWorker.active !== 'activated') throw new Error('Service worker did not activate');
    results.push({ check: 'service-worker', ...serviceWorker });

    const cachedUrls = await page.evaluate(async () => {
      const keys = await caches.keys();
      const requests = await Promise.all(
        keys.map(async (key) => (await caches.open(key)).keys()),
      );
      return requests.flat().map((request) => new URL(request.url).pathname);
    });
    const privateCachedUrl = cachedUrls.find((pathname) =>
      ['/api/auth', '/v', '/login', '/home', '/admin', '/workspace', '/privacy'].some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      ),
    );
    if (privateCachedUrl) throw new Error(`Private route was cached: ${privateCachedUrl}`);
    results.push({ check: 'private-routes-not-cached', status: 'ok' });

    await context.setOffline(true);
    await page.goto(`${baseUrl}/offline-probe`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Psychočas je momentálně offline', { exact: true }).waitFor({ state: 'visible' });
    await page.getByText('Psychočas is currently offline', { exact: true }).waitFor({ state: 'visible' });
    await context.setOffline(false);
    results.push({ check: 'offline-navigation-fallback', status: 'visible' });

    const [rootResponse, swResponse, manifestResponse] = await Promise.all([
      fetch(`${baseUrl}/`),
      fetch(`${baseUrl}/sw.js`),
      fetch(`${baseUrl}/manifest.webmanifest`),
    ]);
    const csp = rootResponse.headers.get('content-security-policy');
    if (!csp?.includes("default-src 'self'")) throw new Error('Missing Content-Security-Policy');
    if (rootResponse.headers.get('x-frame-options') !== 'DENY') throw new Error('Missing frame protection');
    if (!swResponse.headers.get('service-worker-allowed')) throw new Error('Missing service worker scope header');
    if (!manifestResponse.ok) throw new Error('Manifest is unavailable');
    const manifest = (await manifestResponse.json()) as {
      name?: string;
      start_url?: string;
      display?: string;
      icons?: Array<{ purpose?: string }>;
    };
    if (!manifest.name || manifest.start_url !== '/home?source=pwa' || manifest.display !== 'standalone') {
      throw new Error(`Manifest is incomplete: ${JSON.stringify(manifest)}`);
    }
    if (!manifest.icons?.some((icon) => icon.purpose === 'maskable')) {
      throw new Error('Manifest is missing a maskable icon');
    }
    results.push({ check: 'security-and-pwa-headers', status: 'ok' });

    if (errors.length > 0) throw new Error(`Browser errors:\n${errors.join('\n')}`);
    process.stdout.write(`${JSON.stringify({ ok: true, results }, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
