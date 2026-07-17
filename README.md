# Psychočas App

Production-oriented member PWA for Psychočas. The application lives in `nextjs-app` and uses Next.js, Convex, Convex Auth, Resend email OTP, and Vercel.

## Documentation

Start with the [application documentation](nextjs-app/docs/README.md). It is the current source for product scope, roles and permissions, architecture, workflows, data protection, PWA behavior, development, release, and pilot operations.

Legacy Supabase setup notes in the repository are historical records only and are not valid instructions for the active application.

## Pilot scope

- Allowlisted email OTP sign-in and role-aware member sessions
- Digital membership, one-time QR verification, offers, events, feedback, and partner suggestions
- Board/admin membership administration with filters and bulk changes
- Scoped staff assignments for national and local partner, offer, event, campaign, and metric workflows
- Public QR result without member names, email addresses, or exact membership dates
- Czech and English UI with a persistent global language switch
- Installable PWA with an offline fallback and network-only private routes
- Privacy export/request workflow, aggregate metrics, audit logs, and scheduled operational retention

## Local development

```powershell
cd nextjs-app
npm install
npm run convex:dev
npm run dev
```

The frontend needs the Convex values documented in `nextjs-app/.env.local.example`. Backend secrets belong in the selected Convex deployment, never in `NEXT_PUBLIC_*` variables or Git.

## Verification

Run from `nextjs-app`:

```powershell
npm run verify
npx tsc -p convex/tsconfig.json --noEmit
```

For browser tests, start the production build and run `npm run test:browser`. The test covers mobile layouts, CZ/EN persistence, login and public QR screens, security headers, service-worker activation, private-cache exclusion, the web manifest, and offline navigation.

## Production

Convex and Vercel are deployed separately. `npm run build` never deploys a backend.

1. Verify the code locally.
2. Provision the production Convex environment and run `npm run convex:deploy`.
3. Set Vercel public variables to the production Convex cloud/site URLs.
4. Deploy the Next.js package from `nextjs-app`.
5. Run the browser suite against `https://app.psychocas.cz`.

See the [development and release guide](nextjs-app/docs/development-release.md) and [Convex backend guide](nextjs-app/convex/README.md) for exact environment names and deployment checks.
