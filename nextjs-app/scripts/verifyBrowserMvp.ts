import { chromium } from '@playwright/test';

const baseUrl = process.env.PSYCHOCAS_BASE_URL ?? 'http://localhost:3000';
const testEmail = process.env.PSYCHOCAS_TEST_EMAIL?.trim();
const targetHostname = new URL(baseUrl).hostname;
const isLocalTarget = ['localhost', '127.0.0.1', '::1'].includes(targetHostname);

const publicRoutes = [
  { path: '/', width: 320, height: 568, text: 'Členství, slevy a zpětná vazba' },
  { path: '/', width: 390, height: 844, text: 'Členství, slevy a zpětná vazba' },
  { path: '/', width: 768, height: 1024, text: 'Členství, slevy a zpětná vazba' },
  { path: '/', width: 1280, height: 800, text: 'Členství, slevy a zpětná vazba' },
  { path: '/login', width: 320, height: 568, text: 'Přihlášení členů' },
  { path: '/login', width: 390, height: 844, text: 'Přihlášení členů' },
  { path: '/login', width: 768, height: 1024, text: 'Přihlášení členů' },
  { path: '/privacy', width: 320, height: 568, text: 'Ochrana osobních údajů' },
  { path: '/privacy', width: 430, height: 932, text: 'Ochrana osobních údajů' },
  { path: '/privacy', width: 768, height: 1024, text: 'Ochrana osobních údajů' },
  { path: '/privacy', width: 1280, height: 800, text: 'Ochrana osobních údajů' },
  { path: '/v', width: 320, height: 568, text: 'Ověření členské výhody' },
  { path: '/v', width: 390, height: 844, text: 'Ověření členské výhody' },
  { path: '/v', width: 768, height: 1024, text: 'Ověření členské výhody' },
] as const;

const protectedRoutes = ['/home', '/workspace', '/admin'] as const;
const removedRoutes = ['/demo', '/demo/member', '/demo/manager', '/demo/board'] as const;

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
    process.stdout.write('Loading root and waiting for the service worker.\n');
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    const initialServiceWorkerReady = await page.evaluate(async () => {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 15_000)),
      ]);
      return registration !== null;
    });
    if (!initialServiceWorkerReady) throw new Error('Initial service worker registration timed out');
    process.stdout.write('Initial service worker is ready.\n');
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('ERR_ABORTED')) throw error;
      await page.waitForLoadState('domcontentloaded');
    }

    for (const route of publicRoutes) {
      await page.setViewportSize({ width: route.width, height: route.height });
      const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
      if (!response?.ok()) throw new Error(`${route.path} returned ${response?.status() ?? 'no response'}`);
      await page.getByText(route.text, { exact: false }).first().waitFor({ state: 'visible' });
      await page.waitForTimeout(250);
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clippedControls: Array.from(
          document.querySelectorAll<HTMLElement>('button, input, select, textarea, [role="dialog"]'),
        )
          .filter((element) => element.getClientRects().length > 0)
          .filter((element) => element.scrollWidth > element.clientWidth + 1)
          .map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim() ?? element.tagName)
          .slice(0, 5),
      }));
      if (layout.scrollWidth > layout.clientWidth + 1) {
        throw new Error(`${route.path} overflows horizontally at ${route.width}px`);
      }
      if (layout.clippedControls.length > 0) {
        throw new Error(
          `${route.path} clips controls at ${route.width}px: ${layout.clippedControls.join(', ')}`,
        );
      }
      results.push({ route: route.path, viewport: `${route.width}x${route.height}`, ...layout });
      process.stdout.write(`Checked ${route.path} at ${route.width}x${route.height}.\n`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of protectedRoutes) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL((url) => url.pathname === '/login');
      results.push({ route: path, check: 'unauthenticated-redirect', status: 'login' });
    }

    for (const path of removedRoutes) {
      const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
      if (response.status !== 404) {
        throw new Error(`Removed route ${path} returned ${response.status} instead of 404`);
      }
      results.push({ route: path, check: 'removed', status: 404 });
    }

    const installContext = await browser.newContext({
      serviceWorkers: 'allow',
      locale: 'cs-CZ',
      viewport: { width: 320, height: 568 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    });
    try {
      const installPage = await installContext.newPage();
      const installErrors: string[] = [];
      installPage.on('pageerror', (error) => installErrors.push(`pageerror: ${error.message}`));
      installPage.on('console', (message) => {
        if (message.type() === 'error') installErrors.push(`console: ${message.text()}`);
      });

      await installPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      const installDialog = installPage.getByRole('dialog', { name: 'Nainstalovat Psychočas' });
      await installDialog.waitFor({ state: 'visible' });
      const installDialogText = await installDialog.innerText();
      if (!installDialogText.includes('V Safari klepni na Sdílet.')) {
        throw new Error(`The iOS installation steps are missing: ${installDialogText}`);
      }
      const installLayout = await installPage.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      if (installLayout.scrollWidth > installLayout.clientWidth + 1) {
        throw new Error('The PWA install walkthrough overflows at 320px');
      }

      await installPage.getByRole('button', { name: 'Zavřít nabídku instalace' }).click();
      await installPage.reload({ waitUntil: 'domcontentloaded' });
      await installPage.waitForTimeout(1900);
      if ((await installPage.getByRole('dialog', { name: 'Nainstalovat Psychočas' }).count()) > 0) {
        throw new Error('The dismissed PWA install offer appeared again during its cooldown');
      }

      await installPage.getByRole('button', { name: 'Nainstalovat aplikaci' }).click();
      await installPage
        .getByRole('dialog', { name: 'Nainstalovat Psychočas' })
        .waitFor({ state: 'visible' });
      if (installErrors.length > 0) {
        throw new Error(`PWA install walkthrough errors:\n${installErrors.join('\n')}`);
      }
      results.push({
        check: 'mobile-pwa-install-walkthrough',
        viewport: '320x568',
        status: 'auto-offer-dismissal-and-manual-reopen',
      });
    } finally {
      await installContext.close();
    }

    const chromeInstallContext = await browser.newContext({
      serviceWorkers: 'allow',
      locale: 'cs-CZ',
      viewport: { width: 320, height: 568 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/126.0.0 Mobile/15E148 Safari/604.1',
    });
    try {
      const chromeInstallPage = await chromeInstallContext.newPage();
      await chromeInstallPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      const chromeInstallDialog = chromeInstallPage.getByRole('dialog', {
        name: 'Nainstalovat Psychočas',
      });
      await chromeInstallDialog.waitFor({ state: 'visible' });
      const chromeInstallText = await chromeInstallDialog.innerText();
      if (
        !chromeInstallText.includes('Jak nainstalovat v Chromu') ||
        !chromeInstallText.includes('V Chromu klepni na Sdílet') ||
        chromeInstallText.includes('V Safari klepni na Sdílet')
      ) {
        throw new Error(`The Chrome-specific installation steps are incorrect: ${chromeInstallText}`);
      }
      results.push({
        check: 'browser-aware-pwa-install-walkthrough',
        browser: 'chrome-ios',
        viewport: '320x568',
        status: 'chrome-copy-visible',
      });
    } finally {
      await chromeInstallContext.close();
    }

    await page.goto(`${baseUrl}/v`, { waitUntil: 'domcontentloaded' });
    const initialRecoveryToast = page.getByText('Připojení obnoveno. Údaje jsou opět aktuální.', {
      exact: true,
    });
    if ((await initialRecoveryToast.count()) > 0) {
      throw new Error('The recovery toast is visible without a preceding outage');
    }
    await context.setOffline(true);
    await page
      .getByText('Jste offline. Zobrazuje se poslední dostupná verze.', { exact: true })
      .waitFor({ state: 'visible' });
    await context.setOffline(false);
    await initialRecoveryToast.waitFor({ state: 'visible' });
    results.push({ check: 'network-status-toast', status: 'offline-and-recovery-only' });

    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Informace k přihlášení' }).click();
    const infoDialog = page.getByRole('dialog', { name: 'Informace k přihlášení' });
    await infoDialog.waitFor({ state: 'visible' });
    const dialogBounds = await infoDialog.boundingBox();
    if (!dialogBounds || dialogBounds.x < 0 || dialogBounds.x + dialogBounds.width > 321) {
      throw new Error(`Login information dialog escapes the 320px viewport: ${JSON.stringify(dialogBounds)}`);
    }
    results.push({ check: 'login-info-dialog', viewport: '320x568', status: 'visible' });

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
