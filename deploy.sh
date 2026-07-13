#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/nextjs-app"

command -v node >/dev/null 2>&1 || { echo "Node.js is required." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required." >&2; exit 1; }

test -f .env.local || { echo "Missing nextjs-app/.env.local. Link a Convex development deployment first." >&2; exit 1; }
grep -q '^NEXT_PUBLIC_CONVEX_URL=' .env.local || { echo "NEXT_PUBLIC_CONVEX_URL is missing from .env.local." >&2; exit 1; }

npm ci
npm run verify
npx tsc -p convex/tsconfig.json --noEmit

echo "Local release verification passed."
echo "Convex and Vercel deployments are intentionally separate release steps."
