# Psychočas App

A Next.js + Supabase application for Psychočas members. This repository contains the production PWA located in `nextjs-app` along with helper scripts and design assets.

## Highlights
- Magic-link login with support for trusted users who only exist in the `trusted_users` table
- Role-aware navigation for members, managers, council, and technicians
- QR code redemption, validation tools, and analytics dashboards
- Technician console for activating memberships and auditing trusted access
- Localised UI (Czech + English preview) and shared design system primitives

## Getting Started
1. Navigate to the Next.js project
   ```bash
   cd nextjs-app
   npm install
   ```
2. Create `.env.local`
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
   ```
3. Run the development server
   ```bash
   npm run dev
   ```
4. Sign in using an email address that exists in `members` or `trusted_users`. The fallback accepts email-only trusted rows and will normalise optional role or branch data when it is provided.

## Database
Follow `DATABASE_SETUP.md` to apply the Supabase schema and RLS policies. The SQL scripts live in `nextjs-app/sql/` and can be applied in order or via `complete_schema.sql`.

## Helpful Commands
From `nextjs-app`:
```bash
npm run lint   # ESLint
npm run test   # Vitest unit tests
npm run build  # Production build
```

## Verification

To verify that the production bundle builds cleanly and that the Progressive Web App artifacts are generated correctly, run th
e following commands from `nextjs-app`:

```bash
CI=1 npm run build   # Production build with non-interactive logging
npm run test:vercel  # Rebuilds and checks for required PWA service worker assets
```

The `test:vercel` script snapshots and restores `public/sw.js` and the generated fallback scripts so that the working tree rema
ins clean after the check.

## Deployment
Use `deploy.sh` (macOS/Linux) or `deploy.bat` (Windows) from the repository root to verify a production build before deploying to Vercel. The scripts install dependencies, compile the app, and remind you about required Supabase environment variables.

## Next steps
- Finish wiring real analytics data sources for `/stats`
- Expand the technician console with trusted-user expiry management
- Integrate structured logging/monitoring (e.g. Sentry or Logflare)
- Continue refining localisation by extracting remaining hard-coded strings

