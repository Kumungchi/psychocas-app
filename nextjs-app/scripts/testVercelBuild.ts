import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';

function assertPwaArtifacts(publicDir: string): void {
  const swPath = path.join(publicDir, 'sw.js');
  if (!existsSync(swPath)) {
    throw new Error('PWA build verification failed: missing public/sw.js');
  }

  const swContent = readFileSync(swPath, 'utf8');

  if (!swContent.includes('offline.html')) {
    throw new Error('PWA build verification failed: offline fallback was not registered');
  }

  if (
    !swContent.includes('NETWORK_ONLY_PREFIXES') ||
    !swContent.includes("'/v'") ||
    !swContent.includes("'/workspace'") ||
    !swContent.includes('/api/auth')
  ) {
    throw new Error('PWA build verification failed: sensitive routes are not network-only');
  }

  if (swContent.includes('workbox-') || swContent.includes('precacheAndRoute')) {
    throw new Error('PWA build verification failed: stale Workbox runtime detected');
  }
}

function ensureEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    NODE_ENV: 'production',
    VERCEL: env.VERCEL ?? '1',
    CI: env.CI ?? '1',
    NEXT_PUBLIC_CONVEX_URL:
      env.NEXT_PUBLIC_CONVEX_URL ?? 'https://example.convex.cloud',
    NEXT_PUBLIC_DEBUG_LOGGING: env.NEXT_PUBLIC_DEBUG_LOGGING ?? 'false',
  };
}

function run(): void {
  const projectRoot = path.resolve(__dirname, '..');
  const buildDir = path.join(projectRoot, '.next');
  const publicDir = path.join(projectRoot, 'public');
  const keepBuildOutput = process.env.KEEP_NEXT_BUILD === 'true';

  // Always start from a clean build directory so that the test reflects
  // exactly what would happen on Vercel.
  rmSync(buildDir, { recursive: true, force: true });

  try {
    const npmCli = process.env.npm_execpath;
    if (!npmCli) {
      throw new Error('Unable to locate the npm CLI for build verification');
    }

    const build = spawnSync(process.execPath, [npmCli, 'run', 'build'], {
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

  }
}

run();
