#!/usr/bin/env node

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const screenshotsDirectory = path.join(process.cwd(), 'screenshots');
const baseUrl = process.env.PSYCHOCAS_BASE_URL ?? 'http://localhost:3000';

if (!fs.existsSync(screenshotsDirectory)) {
  fs.mkdirSync(screenshotsDirectory, { recursive: true });
}

const viewports = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1366, height: 768 },
} as const;

const pages = [
  { path: '/', name: 'product-overview', sizes: ['mobile', 'tablet', 'desktop'] },
  { path: '/login', name: 'login', sizes: ['mobile', 'tablet', 'desktop'] },
  { path: '/privacy', name: 'privacy', sizes: ['mobile', 'desktop'] },
  { path: '/v', name: 'verification', sizes: ['mobile', 'tablet', 'desktop'] },
] as const;

async function takeScreenshots() {
  const browser = await chromium.launch();
  let savedCount = 0;

  try {
    for (const target of pages) {
      for (const size of target.sizes) {
        const context = await browser.newContext({
          viewport: viewports[size],
          locale: 'cs-CZ',
          serviceWorkers: 'block',
        });
        const page = await context.newPage();
        const response = await page.goto(`${baseUrl}${target.path}`, {
          waitUntil: 'networkidle',
        });

        if (!response?.ok()) {
          throw new Error(`${target.path} returned ${response?.status() ?? 'no response'}`);
        }

        await page.locator('main').waitFor({ state: 'visible' });
        await page.waitForTimeout(500);

        const filename = `${target.name}-${size}.png`;
        await page.screenshot({
          path: path.join(screenshotsDirectory, filename),
          fullPage: true,
        });
        savedCount += 1;
        process.stdout.write(`Saved ${filename}\n`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  if (savedCount !== 11) {
    throw new Error(`Expected 11 screenshots, saved ${savedCount}`);
  }
}

takeScreenshots().catch((error) => {
  console.error(error);
  process.exit(1);
});
