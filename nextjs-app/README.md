# Psychočas Member App

This package contains the public-facing Psychočas PWA. It is built with Next.js 15, Supabase, and Tailwind CSS and is designed to run on Vercel.

## Features
- Magic-link authentication backed by Supabase Auth
- Shared member context that honours `memberships` and `invites` records
- Role-aware navigation and feature gating for members, managers, council, and technicians
- QR-based membership confirmation and token validation workflows
- Technician console for managing member activation and trusted-user access
- Localised UI copy (Czech and English preview) with a runtime language toggle

## Prerequisites
- Node.js 20+
- Supabase project with the schema from `sql/complete_schema.sql`
- Environment variables configured for Supabase (see below)

## Getting Started
1. Install dependencies
   ```bash
   npm install
   ```
2. Provide required environment variables in `.env.local`
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
   ```
3. Start the development server
   ```bash
   npm run dev
   ```
4. Open http://localhost:3000 and sign in with a Supabase account that is present in `memberships` or `invites`.

## Database Notes
- `member_profiles` view powers the full experience, combining `profiles`, `memberships`, and branch details
- `invites` fallback grants access when only an email address is available; optional role, branch, and expiry fields add extra context
- Technicians can toggle `membership_active` directly from the technician console once the service role key is available to the client

See the root-level `DATABASE_SETUP.md` for the full schema walkthrough and policies.

## Available Scripts
```bash
npm run dev       # Start the Next.js development server
npm run build     # Create a production build
npm run start     # Run the production build locally
npm run lint      # Lint the codebase
npm run test      # Execute Vitest unit tests
npm run test:vercel # Smoke-test a production build in a Vercel-like environment
npm run verify    # Run linting, unit tests, and the Vercel build check
```

## Project Structure
```
src/
├── app/               # Route segments (login, home, validate, stats, technician, etc.)
├── components/        # Reusable UI building blocks (navigation, locale toggle, profile drawer)
├── hooks/             # React hooks including useMemberContext and locale handling
├── lib/               # Utilities (Supabase client, logging, offline cache, i18n config)
├── types/             # Shared TypeScript types
├── ui/                # Design system primitives (Button, Card, Badge)
└── tests/             # Vitest suites for helpers
```

## Deployment
The project is optimised for Vercel. Use the helper scripts in the repository root (`deploy.sh` / `deploy.bat`) to install dependencies, run a production build, and verify Supabase connectivity before pushing to production.

For local smoke tests that mirror Vercel, run `npm run verify` — it lints the project, executes the Vitest suites, and performs the same PWA-aware production build verification that Vercel uses.

### Role preview sandbox

When you set `NEXT_PUBLIC_ENABLE_ROLE_PREVIEW=true` in your environment, the `/test` route unlocks a role preview tool. It lets you impersonate manager, council, and technician accounts without sending magic links so you can validate dashboard and redemption flows quickly on shared devices.

