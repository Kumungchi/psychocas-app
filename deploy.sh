#!/bin/bash

# 🚀 Psychočas App - Quick Deployment Script
# Spouští se z root adresáře projektu

set -e

echo "🎯 Psychočas App Deployment Starting..."
echo "=========================================="

# Check requirements
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ NPM is required but not installed. Aborting." >&2; exit 1; }

# Navigate to Next.js app
cd nextjs-app

echo "📦 Installing dependencies..."
npm install

echo "🔧 Building application..."
npm run build

echo "🧪 Running build verification..."
if [ ! -d ".next" ]; then
    echo "❌ Build failed - .next directory not found"
    exit 1
fi

echo "✅ Build successful!"

# Environment check
if [ ! -f ".env.local" ]; then
    echo "⚠️  WARNING: .env.local not found"
    echo "   Please create .env.local with:"
    echo "   NEXT_PUBLIC_SUPABASE_URL=your_url"
    echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key"
    echo "   SUPABASE_SERVICE_ROLE_KEY=your_service_key"
fi

# Supabase check
if command -v supabase >/dev/null 2>&1; then
    echo "🗄️  Checking Supabase connection..."
    if supabase status >/dev/null 2>&1; then
        echo "✅ Supabase connected"
        
        echo "⚡ Deploying Edge Functions..."
        supabase functions deploy
        echo "✅ Edge Functions deployed"
    else
        echo "⚠️  Supabase not linked. Run: supabase link --project-ref YOUR_REF"
    fi
else
    echo "⚠️  Supabase CLI not installed. Run: npm install -g supabase"
fi

echo ""
echo "🎊 DEPLOYMENT COMPLETE!"
echo "======================="
echo ""
echo "Next steps:"
echo "1. 🌐 Deploy to Vercel: https://vercel.com/new"
echo "2. 🗄️  Setup Supabase database: Run sql/complete_schema.sql"
echo "3. 🔧 Configure environment variables in Vercel"
echo "4. ✅ Test production deployment"
echo ""
echo "📚 Documentation:"
echo "   - Complete Setup: COMPLETE_SETUP.md"
echo "   - Database Setup: DATABASE_SETUP.md"  
echo "   - Edge Functions: EDGE_FUNCTIONS_SETUP.md"
echo ""
echo "🚀 Your Psychočas app is ready for production!"