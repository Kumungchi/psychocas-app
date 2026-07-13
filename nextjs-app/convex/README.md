# Psychočas Convex Backend

Convex is the sole runtime database and application backend. Convex Auth sends an eight-digit OTP through Resend and creates a session only for an active access grant or the single allowlisted bootstrap administrator.

## Deployment environments

Each Convex deployment needs these server-side variables:

```text
SITE_URL
JWT_PRIVATE_KEY
JWKS
AUTH_RESEND_KEY
AUTH_EMAIL_FROM
BOOTSTRAP_ADMIN_EMAILS
QR_TOKEN_PEPPER
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

Use different JWT, QR, and VAPID keys in development and production. `SITE_URL` must be the exact frontend origin (`http://localhost:3000` in local development and `https://app.psychocas.cz` in production).

The helper below generates fresh JWT, QR, and VAPID values and pipes every value directly to Convex without printing secrets:

```powershell
$env:PSYCHOCAS_SITE_URL='https://app.psychocas.cz'
$env:AUTH_RESEND_KEY='<set outside Git>'
$env:BOOTSTRAP_ADMIN_EMAILS='viceprezident@psychocas.cz'
npm run convex:provision -- --prod
```

After provisioning, remove temporary process variables and verify names only:

```powershell
Remove-Item Env:AUTH_RESEND_KEY
npx convex env list --prod --names-only
```

## Production deployment

```powershell
npx tsc -p convex/tsconfig.json --noEmit
npm run convex:deploy
npx convex function-spec --prod
```

The production deployment must be in the intended region before member data is imported. A deployment region cannot be changed in place.

## Authorization

- Board/admin: membership access, bulk changes, branches, assignments, approvals, audit, and privacy requests
- Manager: branch-scoped partner, offer, campaign, event/check-in, support, and aggregate metric workflows
- Coordinators/support: only capabilities granted by their scoped staff assignment
- Member: own profile, offers, tokens, events, feedback, suggestions, privacy export, and requests
- Public: one-time QR validation result only; no member identity or exact membership date

All mutations enforce authorization in Convex. UI visibility is an ergonomic layer, not a security boundary.

## PWA and data handling

Private and security-sensitive routes are network-only. QR secrets are HMAC-hashed with the deployment pepper, OTP requests are allowlisted and rate-limited, and operational cleanup runs daily. Public validation responses always use `no-store` headers.
