#!/usr/bin/env node
/**
 * Automated Screenshot Generator for Psychočas Demo
 * Usage: npx ts-node scripts/screenshot-demo.ts
 * 
 * Requirements: npm install -D @playwright/test
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');
const BASE_URL = process.env.PSYCHOCAS_DEMO_BASE_URL ?? 'http://localhost:3000';

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const VIEWPORTS = {
  mobile: { width: 375, height: 667, label: 'mobile' },
  tablet: { width: 768, height: 1024, label: 'tablet' },
  desktop: { width: 1366, height: 768, label: 'desktop' },
};

interface ScreenshotConfig {
  url: string;
  name: string;
  viewports: (keyof typeof VIEWPORTS)[];
  waitFor?: string;
  scrollTo?: 'bottom' | 'middle';
}

const SCREENSHOTS: ScreenshotConfig[] = [
  {
    url: `${BASE_URL}/`,
    name: 'pitch-page',
    viewports: ['mobile', 'desktop'],
    waitFor: 'main',
  },
  {
    url: `${BASE_URL}/demo/member`,
    name: 'member-view',
    viewports: ['mobile', 'tablet', 'desktop'],
    waitFor: 'text=Digitální členství',
    scrollTo: 'bottom',
  },
  {
    url: `${BASE_URL}/demo/manager`,
    name: 'manager-stats',
    viewports: ['mobile', 'tablet', 'desktop'],
    waitFor: 'text=Aktivní nabídky',
    scrollTo: 'middle',
  },
  {
    url: `${BASE_URL}/demo/board`,
    name: 'board-management',
    viewports: ['mobile', 'desktop'],
    waitFor: 'text=Čeká na rozhodnutí',
    scrollTo: 'middle',
  },
];

async function takeScreenshots() {
  console.log('🎨 Psychočas Demo Screenshot Generator\n');
  console.log(`📁 Saving to: ${SCREENSHOTS_DIR}\n`);

  const browser = await chromium.launch();
  let savedCount = 0;

  try {
    for (const screenshot of SCREENSHOTS) {
      console.log(`📸 Processing: ${screenshot.name}`);

      for (const viewportName of screenshot.viewports) {
        const viewport = VIEWPORTS[viewportName as keyof typeof VIEWPORTS];
        
        try {
          const context = await browser.newContext({
            viewport,
            locale: 'cs-CZ',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          });
          const page = await context.newPage();

          console.log(`  → ${viewportName} (${viewport.width}x${viewport.height})`);

          // Demo routes are public, read-only views with no production data.
          await page.goto(screenshot.url, { waitUntil: 'networkidle' });

          // Wait for content
          if (screenshot.waitFor) {
            await page.waitForSelector(screenshot.waitFor, { timeout: 5000 }).catch(() => {
              console.log(`    ⚠️  Selector not found: ${screenshot.waitFor}`);
            });
          }

          // Scroll for better rendering
          if (screenshot.scrollTo === 'bottom') {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          } else if (screenshot.scrollTo === 'middle') {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
          }

          // Let data hydration and transient online/offline toasts settle.
          await page.waitForTimeout(3500);

          // Save screenshot
          const filename = `${screenshot.name}-${viewportName}.png`;
          const filepath = path.join(SCREENSHOTS_DIR, filename);

          await page.screenshot({ path: filepath, fullPage: true });
          savedCount += 1;
          console.log(`    ✅ Saved: ${filename}`);

          await context.close();
        } catch (error) {
          console.error(`    ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      console.log();
    }

    if (savedCount === 0) {
      throw new Error('No screenshots were saved.');
    }

    console.log(`✨ Screenshot generation complete! Saved ${savedCount} screenshots.\n`);
    console.log('📁 Files saved to:', SCREENSHOTS_DIR);
    console.log('\n📝 Next steps:');
    console.log('1. Upload mobile screenshots to SmartMockups: https://smartmockups.com/');
    console.log('2. Create 3D phone mockups for presentations');
    console.log('3. Use desktop screenshots in Figma presentations');
    console.log('4. Check PRESENTATION_GUIDE.md for detailed instructions');
  } finally {
    await browser.close();
  }
}

// Run if called directly
if (require.main === module) {
  takeScreenshots().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { takeScreenshots };
