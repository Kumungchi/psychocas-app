# Psychočas App – Feature Gaps to Consider

## Operational Dashboards
- **Replace placeholder statistics with live analytics.** The statistics screen still renders hard-coded `mockData` arrays for every chart and KPI, so managers and council members cannot review real redemption performance or trends. Hook the cards into Supabase views or materialized reports instead of the current static objects. 【F:nextjs-app/src/app/stats/page.tsx†L16-L166】
- **Enforce role-aware access on analytics routes.** The stats page bootstraps its own role lookup and defaults to `'manager'`, but it never blocks rendering for regular members or trusted-only sessions. Reusing `useMemberContext` (or redirecting early) would prevent unprivileged users from opening `/stats` directly. 【F:nextjs-app/src/app/stats/page.tsx†L56-L85】

## Membership Administration
- **Build a real technician console.** The technician view ships with a `mockMembers` array and even warns admins to manage records in Supabase manually, leaving technicians without actionable tooling. Wiring this page to Supabase queries and mutations (with pagination, filters, and status toggles) would deliver the intended maintenance workflow. 【F:nextjs-app/src/app/technician/page.tsx†L17-L199】
- **Surface trusted-user onboarding in the UI.** Because the technician screen only lists member rows, there is no place to audit or expire `trusted_users` entries after the latest login changes. Extending the console to include trusted records would keep provisional access aligned with policy. 【F:nextjs-app/src/app/technician/page.tsx†L17-L199】

## Validation Experience
- **Ship a production QR scanner.** The validator currently calls `simulateQrScan` and inserts a demo code instead of opening the device camera, so staff must type codes manually in the field. Integrating a real QR reader (or deep-linking to a native scanner) would eliminate the placeholder. 【F:nextjs-app/src/app/validate/page.tsx†L92-L178】
- **Handle rate limits and auditing.** The validator posts directly to the `redeem_token` edge function without throttling feedback, logging metadata, or surfacing retry cooldowns. Adding explicit handling for 429 responses and persisting redemption attempts would harden the workflow against abuse. 【F:nextjs-app/src/app/validate/page.tsx†L52-L78】

## Member Experience
- **Let members manage their profiles.** The home screen presents membership status, partner offers, and token controls but provides no way for users to update contact details or branch preferences in-app. A lightweight profile editor would reduce support load compared with directing every change through staff. 【F:nextjs-app/src/app/home/page.tsx†L43-L600】
- **Expose membership history and receipts.** Members can view only the current token and expiry window; there is no history of past redemptions, invoices, or renewals to answer common support questions. Extending the home view with a redemption timeline or download links would close that gap. 【F:nextjs-app/src/app/home/page.tsx†L255-L600】
