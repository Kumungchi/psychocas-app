# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Active app**: `nextjs-app/` — this is the production app. The `desing/` folder only contains `Logo manuál.pdf`.

## Commands

All commands run from the `nextjs-app/` directory:

```bash
cd nextjs-app

npm run dev          # Start Next.js dev server (localhost:3000)
npm run build        # TypeScript check + production build
npm run test         # Run all Vitest tests once
npm run test:watch   # Run tests in watch mode (re-runs on save)
npx tsc --noEmit     # TypeScript type-check without building
```

To run a single test file: `npx vitest run tests/<filename>`

## Architecture

**Psychočas Member App** — a PWA for Czech psychology students to browse partner discounts and generate QR-based single-use tokens at point of sale. Built with Next.js (App Router), Supabase (Postgres + Auth + Edge Functions), and Tailwind CSS 4.

### Key flows

1. **Auth**: Email OTP (6-digit code) via Supabase Auth. Whitelist-only — only pre-approved emails can log in. `src/app/login/page.tsx`
2. **Browse discounts**: Member sees list of active partner discounts → `src/app/redeem/page.tsx`
3. **Token generation**: Member selects a discount → calls `generate_token` Edge Function → gets a 3-min TTL token → shown as QR code
4. **Validation**: Shop scans QR → opens PUBLIC page → calls `redeem_token` Edge Function → shows member name + discount → marks redeemed
5. **Anti-spam**: DB trigger enforces 1 active token per user at a time

### Project structure

```
nextjs-app/src/
  app/                      # Next.js App Router pages
    login/page.tsx           # OTP login (whitelist pre-check + 6-digit code)
    home/page.tsx            # Member dashboard
    redeem/page.tsx          # Browse & redeem discounts
    stats/page.tsx           # Branch/global statistics
    admin/page.tsx           # Board admin tools
    technician/page.tsx      # Technician console
    validate/page.tsx        # Token validation (manager+)
    manage/page.tsx          # Branch management (manager+)
    auth/callback/route.ts   # Auth callback handler
    test/page.tsx            # Dev sandbox & health check
  hooks/
    useMemberContext.ts      # Member data fetching with whitelist joins
  lib/
    auth/                    # Role routing, membership checks
    supabase/                # Supabase client (browser + server)
    i18n/strings.ts          # Czech + English translations
    offlineCache.ts          # Home snapshot for offline support
    partners.ts              # Partner offer data
    demo/rolePreview.ts      # Demo role switcher (dev only)
  components/                # Shared UI components
  types/
    member.ts                # App types (MemberData, MemberRow, TokenData)
    database.ts              # Supabase DB type map (generated)
  ui/
    theme.ts                 # Design tokens (colors, spacing, radii)
  tests/                     # Vitest test files
```

### Roles

`member` → `manager` → `board` → `technician` — enforced via RLS policies and `members.role` column.

- `member`: browse discounts, generate tokens
- `manager`: + add/edit local discounts/partners, see branch stats
- `board`: + all branches stats, national discounts, manage whitelist (admin)
- `technician`: same as board + full system access (super-admin)

Role hierarchy is numeric: member=1, manager=2, board=3, technician=4. In RLS policies, admin access uses `role IN ('board', 'technician')`.

### Backend

- **Supabase Edge Functions** in `supabase/functions/`:
  - `generate_token` — member requests a token for a discount → returns `token_hash`, `code`, `validation_url`
  - `redeem_token` — PUBLIC endpoint, shop scans QR or enters code → validates, redeems, returns status + member/discount info
- **Database schema** in `sql/`: 11 SQL files covering schema, RLS, triggers, views, seed data, and the `ensure_membership_from_whitelist` RPC
- **Core tables**: `branches`, `member_whitelist` (pre-approved emails + expiry), `members` (created on first login via RPC), `partners`, `discounts`, `tokens` (3-min TTL), `redemptions` (denormalized analytics)

To regenerate DB types after schema changes:
```bash
npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
```

Edge Function env vars (set in Supabase dashboard → Edge Functions → Secrets):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (auto-set by Supabase)
- `APP_URL` — your deployed app URL for building validation links (default: `https://psychocas.vercel.app`)

### Design system

Tailwind CSS 4:
- **Brand colors**: Primary `#1d4f7d`, Accent `#049edb`
- **Font**: Avenir (Light/Medium/Black)
- **Spacing**: 8px grid, card border-radius 16px, button border-radius 24px

### Environment variables

Create `nextjs-app/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

The anon key is safe to expose — it's limited by Row Level Security.

### AI tools in use

- **Claude Code** (me): architecture, DB schema, Supabase integration, auth, edge functions, tests
- **Antigravity** (Google/Cursor-like): UI polish, component styling
- **Codex** (OpenAI): code review, refactoring
