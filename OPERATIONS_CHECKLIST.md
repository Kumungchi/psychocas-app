# ✅ Psychočas Operations Checklist

This guide helps you verify that newly provisioned accounts – including trusted users – can sign in and reach the features that match their role.

## 1. Confirm environment secrets
1. In the Vercel project or `.env.local`, set the Supabase keys:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (only for local edge function calls)
2. Restart the Next.js app after changes so the configuration reloads.

## 2. Seed base data
1. Run the SQL from `sql/complete_schema.sql` if the project is new.
2. Create at least one branch in the `branches` table so member rows can reference it.

## 3. Allow-list trusted users
1. Insert new emails into `trusted_users` using the Supabase Table Editor or SQL:
   ```sql
   insert into trusted_users (email, role, branch_id, membership_active)
   values ('clen@example.cz', 'member', '<branch-uuid>', true);
   ```
2. For temporary access, set `access_expires_at` to the expiry timestamp.
3. Council or technician accounts can be seeded with their higher role immediately.

## 4. Promote to full members
1. When a trusted user completes onboarding, create the canonical `members` row with the matching `auth.users.id`.
2. Copy the `branch_id`, `role`, and `membership_active` values over so their permissions stay consistent.
3. Leave the `trusted_users` row in place until the member confirms their first login, then archive or delete it.

## 5. Smoke test sign-in flows
For each role (`member`, `manager`, `council`, `technician`):
1. Trigger a Supabase magic link from `/login`.
2. Follow the link and ensure the dashboard loads without the "Člen nenalezen" dialog.
3. Confirm the navigation tabs match the role:
   - **Member**: Home only.
   - **Manager**: Home, Validate, Statistics.
   - **Council**: Home, Validate, Statistics, Technician tools.
   - **Technician**: Home, Technician tools.
4. Visit `/validate` while signed in as manager/council and ensure the validator renders. Other roles should be redirected to the home screen.

## 6. Monitor fallbacks
1. The `useMemberContext` hook logs any fallback usage with the `member-context` scope. Keep an eye on logs to verify trusted users are promoted to full members in a timely manner.
2. If you see repeated fallback usage for the same email, prioritise migrating that account into the `members` table.

## 7. Revoke access
1. Set `membership_active = false` in `members` to suspend an account immediately.
2. For trusted-only accounts, either delete the row or set `membership_active = false` and backdate `access_expires_at`.
3. Ask the user to refresh; the context hook clears cached data and the app signs them out.

Keeping this checklist handy will make onboarding and auditing quicker, while ensuring the trusted user safety net remains aligned with production data.
