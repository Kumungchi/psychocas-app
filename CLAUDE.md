# Psychočas repository guide

This file is a concise orientation for coding agents and contributors. The active application is `nextjs-app/`. The current source of truth is the [documentation index](nextjs-app/docs/README.md).

## Runtime

- Next.js App Router and React frontend
- Convex as the only application backend and runtime database
- Convex Auth with allowlisted eight-digit email OTP delivered by Resend
- Vercel hosting and a custom privacy-aware service worker
- Vitest, `convex-test`, and Playwright verification

Supabase code and setup documents are historical. Do not add new runtime dependencies on Supabase.

## Commands

Run commands from `nextjs-app/`:

```powershell
npm install
npm run convex:dev
npm run dev
npm run lint
npm test
npm run verify
npm run test:browser
npm run convex:deploy
```

`npm run build` is a frontend build and never deploys Convex. Production release order is backend first, frontend second. Follow [development and release](nextjs-app/docs/development-release.md).

## System map

- `nextjs-app/src/app`: public, auth, member, workspace, admin, privacy, and QR routes
- `nextjs-app/src/components`: product surfaces and shared UI
- `nextjs-app/src/lib`: auth route policy, i18n, PWA, and shared helpers
- `nextjs-app/convex`: schema, auth, authorization, workflows, analytics, privacy, audit, and retention
- `nextjs-app/public/sw.js`: service worker and cache contract
- `nextjs-app/scripts`: verification, screenshots, provisioning, and release helpers
- `nextjs-app/docs`: maintained product and engineering documentation

## Engineering rules

- Convex server authorization is the security boundary; UI visibility is not authorization.
- Keep staff access capability-based and scoped to `national` or a specific branch.
- Never expose identity or exact membership dates through public QR validation.
- Keep auth, private routes, privacy routes, and QR validation network-only in the service worker.
- Never place JWT, Resend, QR, VAPID, deployment keys, OTP values, or member exports in Git or `NEXT_PUBLIC_*` variables.
- Update the matching document when changing schema, permissions, workflows, retention, PWA caching, or release behavior.
- Preserve mobile-first layouts and Czech/English behavior when changing user-facing surfaces.

## Required reading by change type

| Change | Read first |
|---|---|
| Product behavior or roles | [Product and roles](nextjs-app/docs/product-and-roles.md) |
| System boundary or auth | [Architecture](nextjs-app/docs/architecture.md) |
| Offers, QR, campaigns, events | [Workflows](nextjs-app/docs/workflows.md) |
| Schema, GDPR, retention, secrets | [Data, privacy, and security](nextjs-app/docs/data-privacy-security.md) |
| Build, test, deployment | [Development and release](nextjs-app/docs/development-release.md) |
| Production incident | [Operations runbook](nextjs-app/docs/operations-runbook.md) |
