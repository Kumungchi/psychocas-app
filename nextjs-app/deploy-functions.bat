@echo off
echo 🚀 Deploying Supabase Edge Functions...
echo.

echo Checking Supabase CLI...
supabase --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Supabase CLI not found. Please install it first:
    echo    npm install -g supabase
    pause
    exit /b 1
)

echo ✅ Supabase CLI found
echo.

echo Deploying generate_token function...
supabase functions deploy generate_token
if errorlevel 1 (
    echo ❌ Failed to deploy generate_token
    pause
    exit /b 1
)

echo.
echo Deploying redeem_token function...
supabase functions deploy redeem_token
if errorlevel 1 (
    echo ❌ Failed to deploy redeem_token
    pause
    exit /b 1
)

echo.
echo ✅ All functions deployed successfully!
echo.
echo Functions are available at:
echo   - https://wsgmbtcsyccnzfenfucl.supabase.co/functions/v1/generate_token
echo   - https://wsgmbtcsyccnzfenfucl.supabase.co/functions/v1/redeem_token
echo.
pause