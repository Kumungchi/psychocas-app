# Convex Migration Notes

This folder is the target backend for the Supabase to Convex migration.

Current state:

- `schema.ts` defines the MVP and beta-pilot data model.
- `auth.config.ts`, `auth.ts`, and `http.ts` are prepared for Convex Auth.
- Convex Auth handles an eight-digit email OTP and sessions; there is no magic-link flow.
- Convex calls the Resend HTTP API directly from `ResendOTP.ts`. The Resend key exists only in the Convex deployment environment and is never sent to Next.js or the browser.
- OTP delivery is allowed only for an active `accessGrants` record (or the allowlisted first admin), with a 60-second cooldown and a five-request/15-minute server limit.
- Runtime functions are implemented for member login sync, board/admin access management, bulk membership updates, branch management, and audit logging.
- `/login`, `/home`, and `/admin` use the Convex UI whenever `NEXT_PUBLIC_CONVEX_URL` is set. An explicit `NEXT_PUBLIC_AUTH_BACKEND=supabase` keeps the temporary legacy fallback available.

Initial setup:

1. Create or link the Convex project:

   ```bash
   npm run convex:dev
   ```

2. Generate Convex Auth JWT keys locally:

   ```bash
   npm run convex:auth-keys
   ```

   Do not commit the generated values.

3. Set Convex Auth environment variables on the Convex deployment:

   ```bash
   npx convex env set SITE_URL http://localhost:3000
   npx convex env set JWT_PRIVATE_KEY "..."
   npx convex env set JWKS "..."
   ```

4. Configure local frontend environment:

   ```bash
   NEXT_PUBLIC_CONVEX_URL=https://your-convex-deployment.convex.cloud
   ```

   The Convex URL enables Convex Auth by default. Use `NEXT_PUBLIC_AUTH_BACKEND=supabase` only for a temporary rollback during migration.

5. Configure email delivery before enabling real OTP:

   ```bash
   npx convex env set AUTH_RESEND_KEY your_resend_key
   npx convex env set AUTH_EMAIL_FROM "Psychočas <no-reply@psychocas.cz>"
   ```

   Set these in the Convex dashboard or CLI, never in a `NEXT_PUBLIC_*` variable.

6. Allow the first admin account to bootstrap automatically after verified email login:

   ```bash
   npx convex env set BOOTSTRAP_ADMIN_EMAILS first.admin@psychocas.cz
   ```

   Use a comma-separated list only if more than one person may perform the first setup. No bootstrap controls are exposed in the member UI.

7. Generate Convex types:

   ```bash
   npm run convex:codegen
   ```

8. Implement the remaining server functions in this order:

   - `members.ts`: `viewer`, `ensureViewer`, access grant list/update/bulk update. Done.
   - `branches.ts`: board/admin branch list/create/active toggle. Done.
   - `partners.ts`: board/admin/manager partner CRUD.
   - `offers.ts`: offer list and CRUD with branch scoping.
   - `tokens.ts`: short-lived token creation and public QR scan validation.
   - `analytics.ts`: anonymized board/manager metrics.
   - `feedback.ts`, `partnerSuggestions.ts`, `campaigns.ts`: beta and post-beta workflows.

Authorization requirements:

- Board/admin only: access grants, bulk membership updates, cross-branch changes, campaign publishing.
- Manager: branch-scoped partner/offer CRUD and branch-scoped metrics.
- Member: own profile, available offers, own token creation, feedback, partner suggestions.
- Public: QR scan validation by `publicHash` only.

PWA requirements:

- Never cache `/v/[publicHash]`.
- Never cache token mutation or validation responses.
- Offline mode may show stale member/offers snapshot, but token creation and QR scan require network.
