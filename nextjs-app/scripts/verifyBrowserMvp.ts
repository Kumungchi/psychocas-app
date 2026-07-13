import { chromium } from '@playwright/test';

const baseUrl = process.env.PSYCHOCAS_DEMO_BASE_URL ?? 'http://localhost:3000';
const testEmail = process.env.PSYCHOCAS_TEST_EMAIL?.trim();

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
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  const errors: string[] = [];
  const results: Array<Record<string, unknown>> = [];

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
