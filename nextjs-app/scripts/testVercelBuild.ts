import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const GENERATED_PWA_FILE = /^(?:sw\.js|workbox-[\w-]+\.js|fallback-[\w-]+\.js)$/;

type FileSnapshot = Map<string, Buffer>;

function snapshotGeneratedFiles(publicDir: string): FileSnapshot {
  const snapshot: FileSnapshot = new Map();

  for (const file of readdirSync(publicDir)) {
    if (!GENERATED_PWA_FILE.test(file)) {
      continue;
    }

    const filePath = path.join(publicDir, file);
    if (existsSync(filePath)) {
      snapshot.set(file, readFileSync(filePath));
    }
  }

  return snapshot;
}

function restoreGeneratedFiles(publicDir: string, snapshot: FileSnapshot): void {
  for (const file of readdirSync(publicDir)) {
    if (!GENERATED_PWA_FILE.test(file)) {
      continue;
    }

    const filePath = path.join(publicDir, file);
    const original = snapshot.get(file);

    if (original) {
      writeFileSync(filePath, original);
    } else {
      rmSync(filePath, { force: true });
    }
  }

  for (const [file, content] of snapshot.entries()) {
    const filePath = path.join(publicDir, file);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, content);
    }
  }
}

function assertPwaArtifacts(publicDir: string): void {
  const swPath = path.join(publicDir, 'sw.js');
  if (!existsSync(swPath)) {
    throw new Error('PWA build verification failed: missing public/sw.js');
  }

  const swContent = readFileSync(swPath, 'utf8');

  if (!/precacheAndRoute\(/.test(swContent)) {
    throw new Error('PWA build verification failed: service worker is missing precache configuration');
  }

  if (!swContent.includes('offline.html')) {
    throw new Error('PWA build verification failed: offline fallback was not registered');
  }

  const fallbackMatches = swContent.match(/fallback-[\w-]+\.js/g) ?? [];
  if (fallbackMatches.length === 0) {
    throw new Error('PWA build verification failed: fallback bundles were not generated');
  }

  const uniqueFallbacks = new Set(fallbackMatches);
  for (const fallback of uniqueFallbacks) {
    const fallbackPath = path.join(publicDir, fallback);
    if (!existsSync(fallbackPath)) {
      throw new Error(
        `PWA build verification failed: referenced fallback script ${fallback} was not written to the public directory`,
      );
    }
  }
}

function ensureEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    NODE_ENV: 'production',
    VERCEL: env.VERCEL ?? '1',
    CI: env.CI ?? '1',
    NEXT_PUBLIC_SUPABASE_URL:
      env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key',
    NEXT_PUBLIC_LEGACY_AUTH_ENABLED:
      env.NEXT_PUBLIC_LEGACY_AUTH_ENABLED ?? 'false',
    NEXT_PUBLIC_DEBUG_LOGGING: env.NEXT_PUBLIC_DEBUG_LOGGING ?? 'false',
  };
}

function run(): void {
  const projectRoot = path.resolve(__dirname, '..');
  const buildDir = path.join(projectRoot, '.next');
  const publicDir = path.join(projectRoot, 'public');
  const generatedSnapshot = snapshotGeneratedFiles(publicDir);
  const keepBuildOutput = process.env.KEEP_NEXT_BUILD === 'true';
  const keepPwaArtifacts = process.env.KEEP_PWA_ARTIFACTS === 'true';

  // Always start from a clean build directory so that the test reflects
  // exactly what would happen on Vercel.
  rmSync(buildDir, { recursive: true, force: true });

  try {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const build = spawnSync(npmCommand, ['run', 'build'], {
      cwd: projectRoot,
      env: ensureEnv(process.env),
      stdio: 'inherit',
    });

    if (build.error) {
      throw build.error;
    }

    if (build.status !== 0) {
      throw new Error(`"npm run build" exited with status code ${build.status}`);
    }

    const buildIdPath = path.join(buildDir, 'BUILD_ID');
    if (!existsSync(buildIdPath)) {
      throw new Error('Vercel build verification failed: missing .next/BUILD_ID');
    }

    assertPwaArtifacts(publicDir);
  } finally {
    if (!keepBuildOutput) {
      rmSync(buildDir, { recursive: true, force: true });
    }

    if (!keepPwaArtifacts) {
      restoreGeneratedFiles(publicDir, generatedSnapshot);
    }
  }
}

run();
