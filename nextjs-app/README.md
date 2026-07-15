# Psychočas Member PWA

Mobile-first Next.js application backed exclusively by Convex. Authentication uses Convex Auth and an eight-digit Resend email OTP. Supabase is not used at runtime.

## Commands

```powershell
npm run dev                 # Next.js development server
npm run convex:dev          # Push/watch the selected Convex dev deployment
npm run lint                # ESLint
npm test                    # Vitest
npm run build               # Pure local production build
npm run test:browser        # Playwright MVP/PWA checks against a running build
npm run screenshots         # Responsive screenshots of production public routes
npm run verify              # Lint, unit tests, and Vercel-like production build
npm run convex:deploy       # Deploy Convex functions to the project production deployment
```

## Frontend environment

Copy only the variable names from `.env.local.example` and use the URLs of the selected deployment:

```env
CONVEX_DEPLOYMENT=dev:deployment-name
NEXT_PUBLIC_CONVEX_URL=https://deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://deployment.convex.site
NEXT_PUBLIC_PRIVACY_CONTACT=info@psychocas.cz
```

No email, JWT, QR, push, or deployment secret may use a `NEXT_PUBLIC_*` name.

## Architecture

- `src/app`: public product overview, auth, member, staff, administration, privacy, and QR verification routes
- `src/components`: mobile product surfaces and shared providers
- `src/lib/i18n`: Czech/English dictionaries and pilot copy
- `convex`: schema, auth, authorization, business workflows, analytics, privacy, audit, and retention
- `public/sw.js`: privacy-aware service worker; auth, member, staff, privacy, and QR routes are network-only
- `scripts`: production build, browser, screenshot, key-generation, and deployment provisioning checks

## Release rule

Deploy the backend first, then build the frontend with the resulting production Convex URLs. Run the browser suite against the final custom domain after every production release.
