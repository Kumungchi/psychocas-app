@echo off
setlocal

where node >nul 2>&1 || (echo Node.js is required. & exit /b 1)
where npm >nul 2>&1 || (echo npm is required. & exit /b 1)

cd /d "%~dp0nextjs-app"

if not exist ".env.local" (
  echo Missing nextjs-app\.env.local. Link a Convex development deployment first.
  exit /b 1
)

findstr /b "NEXT_PUBLIC_CONVEX_URL=" .env.local >nul || (
  echo NEXT_PUBLIC_CONVEX_URL is missing from .env.local.
  exit /b 1
)

call npm ci || exit /b 1
call npm run verify || exit /b 1
call npx tsc -p convex/tsconfig.json --noEmit || exit /b 1

echo Local release verification passed.
echo Convex and Vercel deployments are intentionally separate release steps.
endlocal
