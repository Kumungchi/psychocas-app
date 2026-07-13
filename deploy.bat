@echo off
REM 🚀 Psychočas App - Quick Deployment Script (Windows)
REM Spouští se z root adresáře projektu

echo 🎯 Psychočas App Deployment Starting...
echo ==========================================

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is required but not installed. Aborting.
    exit /b 1
)

REM Check NPM
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ NPM is required but not installed. Aborting.
    exit /b 1
)

REM Navigate to Next.js app
cd nextjs-app

echo 📦 Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo ❌ NPM install failed
    exit /b 1
)

echo 🔧 Building application...
npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed
    exit /b 1
)

echo 🧪 Running build verification...
if not exist ".next" (
    echo ❌ Build failed - .next directory not found
    exit /b 1
)

echo ✅ Build successful!

REM Environment check
if not exist ".env.local" (
    echo ⚠️  WARNING: .env.local not found
    echo    Please create .env.local with:
    echo    NEXT_PUBLIC_SUPABASE_URL=your_url
    echo    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
    echo    SUPABASE_SERVICE_ROLE_KEY=your_service_key
)

REM Supabase check
supabase --version >nul 2>&1
if %errorlevel% equ 0 (
    echo 🗄️  Checking Supabase connection...
    supabase status >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ Supabase connected
        
        echo ⚡ Deploying Edge Functions...
        supabase functions deploy
        echo ✅ Edge Functions deployed
    ) else (
        echo ⚠️  Supabase not linked. Run: supabase link --project-ref YOUR_REF
    )
) else (
    echo ⚠️  Supabase CLI not installed. Run: npm install -g supabase
)

echo.
echo 🎊 DEPLOYMENT COMPLETE!
echo =======================
echo.
echo Next steps:
echo 1. 🌐 Deploy to Vercel: https://vercel.com/new
echo 2. 🗄️  Setup Supabase database: Run sql/complete_schema.sql
echo 3. 🔧 Configure environment variables in Vercel
echo 4. ✅ Test production deployment
echo.
echo 📚 Documentation:
echo    - Complete Setup: COMPLETE_SETUP.md
echo    - Database Setup: DATABASE_SETUP.md
echo    - Edge Functions: EDGE_FUNCTIONS_SETUP.md
echo.
echo 🚀 Your Psychočas app is ready for production!

pause