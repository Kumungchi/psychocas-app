# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Active app**: `desing/` (Vite + React). The `nextjs-app/` folder is the old prototype — ignore it.

## Commands

All commands run from the `desing/` directory:

```bash
cd desing

npm run dev          # Start Vite dev server (localhost:5173)
npm run build        # TypeScript check + production build
npm run preview      # Preview the production build locally
npm run test         # Run all Vitest tests once
npm run test:watch   # Run tests in watch mode (re-runs on save)
npm run test:ui      # Open Vitest browser UI
npm run typecheck    # TypeScript type-check without building
```

To run a single test file: `npx vitest run src/tests/<filename>`

## Architecture

**Psychočas Member App** — a PWA for Czech psychology students to browse partner discounts and generate QR-based single-use tokens at point of sale. Built with Vite + React 18, React Router v6, Supabase (Postgres + Auth + Edge Functions), shadcn/ui, and Tailwind CSS 4.

### Key flows

1. **Auth**: Email OTP (6-digit code) via Supabase Auth. Whitelist-only — only pre-approved emails can log in. `src/contexts/AuthContext.tsx`
2. **Browse discounts**: Member sees list of active partner discounts → `src/pages/DiscountsPage.tsx`
3. **Token generation**: Member selects a discount → calls `generate_token` Edge Function → gets a 3-min TTL token → shown as QR code → `src/pages/TokenPage.tsx`
4. **Validation**: Shop scans QR → opens PUBLIC page `/v/:tokenHash` → calls `redeem_token` Edge Function → shows member name + discount → marks redeemed → `src/pages/ValidatePage.tsx`
5. **Anti-spam**: DB trigger enforces 1 active token per user at a time

### Routes (React Router v6)

| Route | Component | Access |
|-------|-----------|--------|
| `/login` | `LoginPage` | Public (redirects if already authed) |
| `/` | `HomePage` | Private — member+ |
| `/discounts` | `DiscountsPage` | Private — member+ |
| `/token/:id` | `TokenPage` | Private — member+ |
| `/manage` | `ManagePage` | Private — manager+ |
| `/stats` | `StatsPage` | Private — manager+ |
| `/v/:tokenHash` | `ValidatePage` | **Public** — no login needed |

### Project structure

```
desing/src/
  App.tsx                   # Route definitions + ProtectedRoute guard
  main.tsx                  # Entry point — wraps app in AuthProvider + BrowserRouter
  contexts/
    AuthContext.tsx          # Global auth state (user, signIn, verifyOtp, signOut)
  lib/
    supabase.ts              # Single Supabase client instance (typed with Database)
  pages/                    # One file per route
  types/
    index.ts                 # All app types (DB rows, auth, API, UI state)
    database.ts              # Supabase DB type map (for typed queries)
  tests/
    setup.ts                 # Vitest setup file
    auth.test.ts             # Auth business logic tests
    token.test.ts            # Token logic tests
```

### Roles

`member` → `manager` → `board` → `technician` — enforced via RLS policies and `members.role` column.

- `member`: browse discounts, generate tokens
- `manager`: + add/edit local discounts/partners, see branch stats
- `board`: + all branches stats, national discounts, manage whitelist (admin)
- `technician`: same as board + full system access (super-admin)

Role hierarchy is numeric: member=1, manager=2, board=3, technician=4. Use `hasRole(user.role, requiredRole)` from `src/lib/auth.ts` to check access. In RLS policies, admin access uses `role IN ('board', 'technician')`.

### Backend

- **Supabase Edge Functions** in `supabase/functions/`:
  - `generate_token` — member requests a token for a discount → returns `token_hash`, `code`, `validation_url`
  - `redeem_token` — PUBLIC endpoint, shop scans QR or enters code → validates, redeems, returns status + member/discount info
- **Database schema** in `sql/`: `01_schema.sql` (tables + indexes), `02_rls_policies.sql` (RLS + grants), `03_triggers.sql` (anti-spam + cleanup + stats view), `04_seed.sql` (test data)
- **Core tables**: `branches`, `member_whitelist` (pre-approved emails), `members` (created on first login), `partners`, `discounts`, `tokens` (3-min TTL), `redemptions` (denormalized analytics)

To regenerate DB types after schema changes:
```bash
npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
```

Edge Function env vars (set in Supabase dashboard → Edge Functions → Secrets):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (auto-set by Supabase)
- `APP_URL` — your deployed app URL for building validation links (default: `https://psychocas.vercel.app`)

### Design system

Tailwind CSS 4 + shadcn/ui components:
- **Brand colors**: Primary `#1d4f7d`, Accent `#049edb`
- **Font**: Avenir (Light/Medium/Black)
- **Spacing**: 8px grid, card border-radius 16px, button border-radius 24px

### Environment variables

Create `desing/.env` (copy from `.env.example`):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Note: Vite requires the `VITE_` prefix (not `NEXT_PUBLIC_`). The anon key is safe to expose — it's limited by Row Level Security.

### AI tools in use

- **Claude Code** (me): architecture, DB schema, Supabase integration, auth, edge functions, tests
- **Antigravity** (Google/Cursor-like): UI polish, component styling
- **Codex** (OpenAI): code review, refactoring
