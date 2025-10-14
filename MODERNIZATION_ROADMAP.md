# Psychočas App – Modernisation Roadmap

This roadmap highlights product and platform upgrades that would make the Psychočas app feel more modern, resilient, and streamlined for members, partners, and staff.

## 1. Product Experience
- **Adopt a shared design system.** Primary screens still compose Tailwind utility strings and inline colour styles directly inside components (for example, the navigation bar sets hex colours and spacing imperatively). Introducing tokens and reusable primitives (e.g. buttons, cards, badges) would keep the interface consistent and simplify future redesigns. 【F:nextjs-app/src/components/Navigation.tsx†L29-L73】
- **Introduce localisation infrastructure.** Copy across the home and validation flows is hard-coded in Czech strings. Wiring Next.js internationalisation (or `next-intl`) would let you expose an English preview for partners without manually editing each component. 【F:nextjs-app/src/app/home/page.tsx†L36-L200】【F:nextjs-app/src/app/validate/page.tsx†L145-L199】
- **Give members self-service profile controls.** The home page renders membership metadata, partner offers, and token controls but never lets a user update contact details or branch preferences. A profile drawer tied to Supabase mutations would reduce support tickets. 【F:nextjs-app/src/app/home/page.tsx†L80-L200】

## 2. Data & Insights
- **Replace mocked analytics with live telemetry.** The statistics dashboard still feeds cards and charts with a `mockData` object, so managers cannot see real redemption volumes or conversion rates. Backing the widgets with Supabase views or a small event warehouse would unlock actionable reporting. 【F:nextjs-app/src/app/stats/page.tsx†L18-L129】
- **Capture membership activity history.** Token generation currently overwrites the single `token` payload in state, leaving no audit of previous codes or expiry events. Persisting a history table (and visual timeline) would help support teams trace suspicious usage. 【F:nextjs-app/src/app/home/page.tsx†L400-L457】
- **Add operational analytics for technicians.** The technician console toggles membership flags but does not surface aggregate health (e.g. count of expiring trusted users). Layering summary widgets and trend charts would help the operations team act proactively. 【F:nextjs-app/src/app/technician/page.tsx†L69-L198】

## 3. Automation & Workflow
- **Upgrade the QR validation flow.** The validator still calls `simulateQrScan` instead of opening the device camera, which prevents frontline staff from using the scanner in production. Integrating `@zxing/browser` or native camera APIs would deliver the expected experience. 【F:nextjs-app/src/app/validate/page.tsx†L92-L100】
- **Instrument administrative actions.** Toggling member activity runs direct Supabase updates without any audit trail or notification hooks. Recording each change in a `membership_events` log and sending webhook alerts would add accountability. 【F:nextjs-app/src/app/technician/page.tsx†L158-L197】
- **Automate partner onboarding.** Partner offers are grouped client-side after fetching raw records, but the platform lacks any workflow to invite new partners or rotate their QR payloads. Extending the technician area with partner CRUD screens (backed by Supabase RPCs) would streamline daily operations. 【F:nextjs-app/src/app/home/page.tsx†L494-L502】

## 4. Platform Resilience
- **Provide offline-friendly token fallbacks.** When users are offline the app can only queue a single pending token request and shows error banners. Supporting background sync or limited-use offline codes would make the experience smoother during poor connectivity. 【F:nextjs-app/src/app/home/page.tsx†L409-L457】
- **Layer observability across services.** The client logs to the console through `logDebug/logError`, but there is no integration with hosted monitoring. Forwarding errors and critical events to Sentry or Logflare would help diagnose issues after release. 【F:nextjs-app/src/lib/logging.ts†L1-L69】
- **Harden access management flows.** The technician panel currently manages `members` and `trusted_users` but lacks bulk operations such as scheduled expiries or CSV imports. Building batch tooling (and guardrails around accidental deactivation) would prepare the system for larger cohorts. 【F:nextjs-app/src/app/technician/page.tsx†L86-L199】

## 5. Ecosystem Extensions
- **Partner-facing verification portal.** Today the redeem screen simply encodes "Člen Psychočas" into a QR code for partners to scan, offering no dashboard for partner staff. A lightweight web portal backed by Supabase row-level security could let businesses verify codes securely without relying on screenshots. 【F:nextjs-app/src/app/redeem/page.tsx†L58-L97】
- **CRM and messaging hooks.** There is no integration for automatically welcoming new members, nudging renewals, or notifying partners about status changes. Connecting Supabase triggers to marketing automation (e.g. Resend, Customer.io) would modernise communication without manual outreach. 【F:nextjs-app/src/app/home/page.tsx†L80-L200】

These initiatives combine UX polish with operational maturity, bringing the Psychočas platform closer to a production-ready, modern membership experience.
