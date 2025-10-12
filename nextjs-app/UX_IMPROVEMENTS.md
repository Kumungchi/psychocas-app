# Psychočas UX & Usability Improvement Opportunities

## Overview
A review of the current Psychočas application highlights strong progress on offline resilience, branch-aware partner management, and localized messaging. The list below captures targeted follow-up ideas to keep refining smoothness, inclusivity, and everyday usability for members, managers, and council users.

## Accessibility & Inclusivity Enhancements
- **Elevate navigation semantics.** The bottom tab bar is built from unlabelled buttons without a surrounding `<nav>` landmark or `aria-current` hints, which makes orientation harder for screen reader users.【F:src/components/Navigation.tsx†L30-L73】 Wrapping the menu in a navigation region, turning each control into a link, and surfacing descriptive labels (including the current page state) would improve assistive technology support.
- **Expose network changes as live regions.** The offline toast already signals connectivity transitions, but it renders as plain text without `role="status"` or keyboard focus handling, so the alert can be missed by non-visual users.【F:src/components/OfflineToast.tsx†L39-L52】 Announcing it via ARIA live regions and providing a dismiss shortcut would make the offline mode clearer and more inclusive.
- **Improve colour contrast and offer a dark theme.** Key UI sections (e.g., cards and call-to-action buttons) rely on fixed inline colours such as #1d4f7d and #9ca3af, which may not meet WCAG contrast ratios for all states.【F:src/app/home/page.tsx†L715-L793】 Centralising these colours in Tailwind tokens, verifying contrast, and offering a high-contrast or dark theme toggle would help low-vision members.
- **Support scalable typography.** Inline font sizing on the login and home screens can clip or misalign at large browser zoom levels.【F:src/app/login/page.tsx†L84-L200】【F:src/app/home/page.tsx†L727-L857】 Replacing fixed pixel sizes with relative units and testing at 200% zoom will keep the app legible for users needing larger text.

## Interaction Flow & Feedback
- **Clarify token queue states.** Offline token requests now queue silently besides the banner text; layering in a small timeline or toast history showing when a request will be retried can reassure members waiting for connectivity.【F:src/app/home/page.tsx†L41-L214】【F:src/app/home/page.tsx†L700-L857】 A progress log or countdown would close the feedback loop.
- **Broaden magic-link guidance.** The login confirmation card lists steps after sending a link, but it does not mention spam-folder tips or the valid timeframe.【F:src/app/login/page.tsx†L120-L200】 Including these notes, plus a secondary “change email” affordance, would reduce confusion if the mail arrives late.
- **Add in-context help for managers/admins.** The admin tooling performs powerful partner edits but the page lacks inline explanations of national vs. local scope or audit behaviour. Embedding short helper tooltips near each form control (and linking back to the process docs) would make the workflows friendlier for occasional users.【F:src/app/admin/page.tsx†L1-L200】

## Offline & PWA Experience
- **Publish a first-run checklist.** The install CTA offers guidance once the browser exposes the install prompt, yet members without that prompt only see a static hint.【F:src/app/home/page.tsx†L751-L793】 Providing a modal or expandable FAQ with screenshots for Android, iOS Safari, and desktop would help every branch member successfully add the PWA.
- **Surface snapshot freshness globally.** Snapshot timestamps currently appear only on the profile card and toast, so managers viewing stats or partner lists may not realise data is cached.【F:src/app/home/page.tsx†L809-L857】 Mirroring the “last synced” badge in partner sections and future dashboards would keep expectations aligned offline.
- **Offer manual sync controls beyond Home.** Offline queuing lives on the member dashboard, but validation, redeem, and admin sections still assume connectivity. Extending the shared network-status hook to those routes would let staff retry requests confidently across the whole app.【F:src/hooks/useNetworkStatus.ts†L1-L33】【F:src/app/redeem/page.tsx†L1-L120】

## Visual & Content Consistency
- **Move inline styles into design tokens.** Many cards and buttons define colours, spacing, and typography through inline style objects, making tweaks repetitive and error-prone.【F:src/app/home/page.tsx†L715-L857】【F:src/app/login/page.tsx†L84-L200】 Consolidating them into Tailwind utility classes or CSS variables will ensure consistent branding and simplify future theming work.
- **Standardise iconography sizes and alignment.** Icons across navigation, banners, and cards use ad-hoc sizing (h-4, h-5, inline SVGs). Establishing a shared icon component with accessible titles will keep visuals balanced and better support RTL/localised variants.【F:src/app/home/page.tsx†L700-L857】【F:src/components/Navigation.tsx†L30-L73】
- **Expand localisation coverage.** Most copy is Czech, but some component props and toasts (e.g., `status-active` labels) mix Czech and English tokens.【F:src/app/home/page.tsx†L828-L841】 Extracting strings into a localisation file prepares the app for future multilingual branches and avoids stray English fragments.

## Operational Follow-ups
- **Automate inclusive design checks.** Integrate axe-core or pa11y audits in CI alongside existing lint/test/build scripts to catch accessibility regressions early.【F:package.json†L11-L25】 Pairing these with Percy or Playwright visual tests would also validate layout consistency after styling refinements.
- **Document UX decisions in the knowledge base.** The repository already hosts rich setup guides; adding a UX playbook summarising component patterns, colour tokens, and offline behaviours would help future contributors extend the experience without duplicating work.【F:README.md†L1-L120】【F:TRUSTED_USERS_SYSTEM.md†L1-L80】

These iterations aim to keep the Psychočas experience friendly across devices and contexts while reinforcing accessibility commitments for every member.
