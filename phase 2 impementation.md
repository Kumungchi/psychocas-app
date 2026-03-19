# Phase 2 — Lint, Auth Testing & Manual QA

## Kontext

Architektura je hotová: všech 6 stránek postaveno, SQL schéma nasazeno (7 tabulek + view + RLS + triggery + seed), Edge Functions běží (`generate_token`, `redeem_token`), Vercel běží, TypeScript build prochází s 0 chybami, 29 unit testů prochází.

Cíl této fáze: posun z „architektura hotová“ na „aplikace ručně testovatelná“ — ESLint, zpevnění OTP UX, konfigurace session, provision test uživatelů, opravy poboček.

- **Supabase projekt**: `wsgmbtcsyccnzfenfucl` (`https://wsgmbtcsyccnzfenfucl.supabase.co`)

---

## Step 1: ESLint Setup

### Proč

TypeScript strict mode chytá typové chyby, ale ne React-specifické věci (rules of hooks, exhaustive deps) ani kvalitu kódu. Požadavek je „lint a typechecks“.

### Instalace

```bash
cd desing
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh
```

### Vytvořit `desing/eslint.config.js`

```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'src/components/ui/_unused', 'src/components/_legacy'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
)
```

### Skripty do `desing/package.json`

```json
{
  "scripts": {
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix"
  }
}
```

### Očekávané lint issues k opravě

1. `PWAInstallPrompt.tsx:13` — `useState<any>(null)` pro `deferredPrompt`.
   - Oprava: typovat jako `useState<Event | null>(null)` nebo lokálně vypnout `@typescript-eslint/no-explicit-any` s odůvodněním (typ `BeforeInstallPromptEvent` není v TS lib).
2. `ManagePage.tsx:70` — `(d: any)` v `.map` callbacku.
   - Oprava: typovat parametr podle návratu `select` ze Supabase nebo použít inline typ.
3. `StatsPage.tsx` a `ManagePage.tsx` — `react-hooks/exhaustive-deps` může hlásit chybějící deps.
   - Oprava: `useCallback`, nebo cílené vypnutí s vysvětlením (refetch jen při změně filtru, ne při změně reference funkce).

---

## Step 2: OTP Input Hardening

- **Soubor**: `src/pages/LoginPage.tsx`

### 2a. Omezit vstup jen na číslice

```ts
import { REGEXP_ONLY_DIGITS } from 'input-otp'
```

```tsx
<InputOTP
  maxLength={6}
  value={otp}
  onChange={setOtp}
  pattern={REGEXP_ONLY_DIGITS}
>
```

Pozn.: zlepší UX na mobilu (numeric keyboard).

### 2b. Auto-submit při 6. číslici

Implementovat `onComplete` (pokud verze `input-otp` podporuje), jinak fallback přes `onChange` + kontrolu délky.

### 2c. Větší sloty na mobilu

- **Soubor**: `src/components/ui/input-otp.tsx`
- Změnit `h-9 w-9` → `h-12 w-12`, `text-sm` → `text-lg`.

---

## Step 3: Session Configuration

### 3a. Konfigurace Supabase klienta

- **Soubor**: `src/lib/supabase.ts`
- Přidat `detectSessionInUrl: false` (OTP, ne magic link).

### 3b. Nastavení v Supabase Dashboard

- **URL**: `https://supabase.com/dashboard/project/wsgmbtcsyccnzfenfucl/settings/auth`
- Zkontrolovat a upravit:
  - JWT expiry (access token): ponechat (1h)
  - Refresh token lifetime: doporučeno zvýšit na 30 dní
  - OTP expiry: ponechat (10 min)
  - Email confirmations: ponechat zapnuté
  - Double confirm email changes: ponechat zapnuté

### 3c. Toast při vypršení session

- **Soubor**: `src/contexts/AuthContext.tsx`
- V `onAuthStateChange` přidat toast při `SIGNED_OUT`, pokud uživatel byl předtím přihlášen.

---

## Step 4: Fix Branches

Seed data má 3 pobočky (Praha, Brno, Olomouc), ale je potřeba upravit podle reálných poboček.

- Upravit `sql/04_seed.sql` (názvy/města) a znovu spustit seed:

```bash
cd desing
SUPABASE_ACCESS_TOKEN='<REDACTED>' npx supabase db query --linked -f sql/04_seed.sql
```

Pozn.: seed používá `ON CONFLICT ... DO UPDATE`, je bezpečné spouštět opakovaně.

Pokud se změní UUID poboček, aktualizovat reference v `04_seed.sql` (whitelist, partners, atd.).

---

## Step 5: Create Test Users for Manual Login

Problém: `.test` emaily nedostávají reálné OTP. Potřebujeme možnost přihlásit se jako `member/board/technician`.

### Řešení: dev-only password login + skript pro vytvoření auth uživatelů

#### 5a. Vytvořit `desing/scripts/setup-test-users.ts`

- Použije service role key (admin API).
- Spouštění:

```bash
cd desing
SUPABASE_SERVICE_ROLE_KEY='<REDACTED>' npx tsx scripts/setup-test-users.ts
```

Service role key je v dashboardu (tajný klíč, ne anon key):
`https://supabase.com/dashboard/project/wsgmbtcsyccnzfenfucl/settings/api`

#### 5c. Přidat dev-only password login do `LoginPage`

- Pouze v `import.meta.env.DEV` a jen pro `@psychocas.test`.
- Přidat pole pro heslo a cestu `signInWithPassword`.

---

## Step 6: Create Test Discounts

Po vytvoření admin účtu získat `members.id` a vložit test slevy (nebo použít UI na `ManagePage`).

---

## Step 7: Manual QA Checklist

### Build & Lint

- `npm run lint` — bez errorů (warningy OK)
- `npm run build` — bez TS chyb
- `npm run test` — 29/29 testů prochází
- ověřit, že dev-only kód není v produkčním buildu (hledat `psychocas.test` ve `dist/`)

### Auth Flow

- real email (`bunnik.matias@seznam.cz`) — OTP dorazí, login OK
- test účty (`@psychocas.test` + heslo) — pouze dev mode
- non-whitelisted email → „Váš email není registrován...“
- deaktivovaný účet → „Váš účet byl deaktivován...“
- špatný OTP → error + vymazání vstupu
- OTP auto-submit na 6. číslici, funguje paste, na mobilu numeric keyboard

### Session Persistence

- refresh stránky → stále přihlášen
- zavřít/otevřít prohlížeč → stále přihlášen
- sign out → redirect na `/login`
- back po sign out neukáže chráněný obsah

### Role-Based Access

- member vidí home/discounts/token; nevidí manage/stats
- board/technician vidí manage/stats
- přímý URL `/manage` nebo `/stats` jako member → redirect

### Feature Checks

- Discounts: správné groupování
- badge „Aktivní/Neaktivní“
- Token: volá Edge Function, ukáže QR + countdown
- Validate (`/v/:hash`): správný stav po skenu

---

## Shrnutí souborů k úpravě

- `eslint.config.js` — vytvořit
- `package.json` — přidat `lint`, `lint:fix`
- `src/pages/LoginPage.tsx` — digits-only OTP + auto-submit + dev-only password login
- `src/components/ui/input-otp.tsx` — větší sloty
- `src/lib/supabase.ts` — session config (`detectSessionInUrl: false`)
- `src/contexts/AuthContext.tsx` — toast při nečekaném odhlášení
- `scripts/setup-test-users.ts` — vytvořit
- `sql/04_seed.sql` — opravit pobočky (dle potřeby)

## Execution Order

1. ESLint setup + opravy lintu (nezávislé)
2. OTP hardening (nezávislé)
3. Session config (kód + dashboard) (nezávislé)
4. Opravit pobočky v seed SQL + re-run (nezávislé)
5. Skript test userů + spustit (vyžaduje service role key)
6. Dev-only password login do `LoginPage` (po kroku 5)
7. Přihlásit se jako každý uživatel, nastavit role přes SQL (po kroku 6)
8. Vytvořit test slevy (po kroku 7)
9. Full manual QA checklist (po všem)

Pozn.: kroky 1–4 lze dělat paralelně. Kroky 5–9 jsou sekvenční.

---

## Původní výpis z terminálu (řádky 15–746)

> Pozn.: citlivé hodnoty (např. `SUPABASE_ACCESS_TOKEN`) jsou v tomto výpisu redigované.

```
│ Plan to implement                       │
│                                         │
│ Phase 2 — Lint, Auth Testing & Manual   │
│ QA                                      │
│                                         │
│ Context                                 │
│                                         │
│ Architecture is complete. All 6 pages   │
│ built, SQL schema deployed (7 tables +  │
│ view + RLS + triggers + seed), Edge     │
│ Functions live (generate_token,         │
│ redeem_token), Vercel running,          │
│ TypeScript build passes with 0 errors,  │
│ 29 unit tests passing. This phase takes │
│  us from "architecture done" to         │
│ "manually testable app" — ESLint, OTP   │
│ hardening, session config, test user    │
│ provisioning, and branch corrections.   │
│                                         │
│ Supabase project: wsgmbtcsyccnzfenfucl  │
│ at https://wsgmbtcsyccnzfenfucl.supabas │
│ e.co                                    │
│                                         │
│ ---                                     │
│ Step 1: ESLint Setup                    │
│                                         │
│ Why                                     │
│                                         │
│ TypeScript strict mode catches type     │
│ errors but not React-specific issues    │
│ (hooks rules, exhaustive deps) or code  │
│ quality patterns. User explicitly       │
│ requested "lint and typechecks".        │
│                                         │
│ Install                                 │
│                                         │
│ cd desing                               │
│ npm install -D eslint @eslint/js        │
│ typescript-eslint                       │
│ eslint-plugin-react-hooks               │
│ eslint-plugin-react-refresh             │
│                                         │
│ Create desing/eslint.config.js          │
│                                         │
│ import js from '@eslint/js'             │
│ import tseslint from                    │
│ 'typescript-eslint'                     │
│ import reactHooks from                  │
│ 'eslint-plugin-react-hooks'             │
│ import reactRefresh from                │
│ 'eslint-plugin-react-refresh'           │
│                                         │
│ export default tseslint.config(         │
│   { ignores: ['dist', 'node_modules',   │
│ 'src/components/ui/_unused',            │
│ 'src/components/_legacy'] },            │
│   js.configs.recommended,               │
│   ...tseslint.configs.recommended,      │
│   {                                     │
│     plugins: {                          │
│       'react-hooks': reactHooks,        │
│       'react-refresh': reactRefresh,    │
│     },                                  │
│     rules: {                            │
│       ...reactHooks.configs.recommended │
│ .rules,                                 │
│                                         │
│ 'react-refresh/only-export-components': │
│  ['warn', { allowConstantExport: true   │
│ }],                                     │
│                                         │
│ '@typescript-eslint/no-explicit-any':   │
│ 'warn',                                 │
│                                         │
│ '@typescript-eslint/no-unused-vars':    │
│ ['error', { argsIgnorePattern: '^_' }], │
│     },                                  │
│   },                                    │
│ )                                       │
│                                         │
│ Add scripts to desing/package.json      │
│                                         │
│ "lint": "eslint src/",                  │
│ "lint:fix": "eslint src/ --fix"         │
│                                         │
│ Expected lint issues to fix             │
│                                         │
│ 1. PWAInstallPrompt.tsx:13 —            │
│ useState<any>(null) for deferredPrompt. │
│  Fix: type as useState<Event |          │
│ null>(null) or add //                   │
│ eslint-disable-next-line                │
│ @typescript-eslint/no-explicit-any with │
│  comment about BeforeInstallPromptEvent │
│  not being in TS lib.                   │
│ 2. ManagePage.tsx:70 — (d: any) in map  │
│ callback. Fix: type the parameter based │
│  on the Supabase select return shape or │
│  use an inline type.                    │
│ 3. StatsPage.tsx and ManagePage.tsx —   │
│ react-hooks/exhaustive-deps may flag    │
│ fetchData/fetchStats not in useEffect   │
│ deps. Fix: either wrap in useCallback   │
│ or add // eslint-disable-next-line      │
│ react-hooks/exhaustive-deps with a      │
│ comment explaining it's intentional (we │
│  want to re-fetch when filter changes,  │
│ not when the function reference         │
│ changes).                               │
│                                         │
│ ---                                     │
│ Step 2: OTP Input Hardening             │
│                                         │
│ File: src/pages/LoginPage.tsx           │
│                                         │
│ 2a. Restrict to digits only             │
│                                         │
│ The input-otp library exports           │
│ REGEXP_ONLY_DIGITS. Add it to restrict  │
│ input:                                  │
│                                         │
│ // Add import:                          │
│ import { REGEXP_ONLY_DIGITS } from      │
│ 'input-otp'                             │
│                                         │
│ // Change the InputOTP component (line  │
│ 85):                                    │
│ <InputOTP maxLength={6} value={otp}     │
│ onChange={setOtp}                       │
│ pattern={REGEXP_ONLY_DIGITS}>           │
│                                         │
│ This also triggers the numeric keyboard │
│  on mobile — critical UX improvement.   │
│                                         │
│ 2b. Auto-submit on 6th digit            │
│                                         │
│ Add an onComplete handler that          │
│ auto-submits when all 6 digits are      │
│ entered:                                │
│                                         │
│ // Add this function inside LoginPage:  │
│ async function handleAutoSubmit(code:   │
│ string) {                               │
│   if (loading) return                   │
│   setOtp(code)                          │
│   setLoading(true)                      │
│   const { error } = await               │
│ verifyOtp(email, code)                  │
│   setLoading(false)                     │
│   if (error) {                          │
│     toast.error(error)                  │
│     setOtp('')                          │
│   } else {                              │
│     navigate('/')                       │
│   }                                     │
│ }                                       │
│                                         │
│ // Update InputOTP (line 85):           │
│ <InputOTP                               │
│   maxLength={6}                         │
│   value={otp}                           │
│   onChange={setOtp}                     │
│   onComplete={handleAutoSubmit}         │
│   pattern={REGEXP_ONLY_DIGITS}          │
│ >                                       │
│                                         │
│ Important: Check if input-otp v1.4.x    │
│ supports onComplete prop. If not, use   │
│ onChange with a length check:           │
│ onChange={(val) => {                    │
│   setOtp(val)                           │
│   if (val.length === 6 && !loading)     │
│ handleAutoSubmit(val)                   │
│ }}                                      │
│                                         │
│ 2c. Increase slot size for mobile       │
│                                         │
│ In src/components/ui/input-otp.tsx,     │
│ line 54, change the InputOTPSlot        │
│ className:                              │
│ - Change h-9 w-9 to h-12 w-12 (48px —   │
│ better mobile tap target)               │
│ - Change text-sm to text-lg (larger     │
│ digits)                                 │
│                                         │
│ ---                                     │
│ Step 3: Session Configuration           │
│                                         │
│ 3a. Supabase client config              │
│                                         │
│ File: src/lib/supabase.ts               │
│                                         │
│ Add detectSessionInUrl: false (we use   │
│ OTP, not magic links):                  │
│ export const supabase =                 │
│ createClient<Database>(supabaseUrl,     │
│ supabaseAnonKey, {                      │
│   auth: {                               │
│     persistSession: true,               │
│     autoRefreshToken: true,             │
│     detectSessionInUrl: false,          │
│   },                                    │
│ })                                      │
│                                         │
│ 3b. Supabase Dashboard settings         │
│                                         │
│ Go to                                   │
│ https://supabase.com/dashboard/project/ │
│ wsgmbtcsyccnzfenfucl/settings/auth      │
│                                         │
│ Verify and adjust:                      │
│                                         │
│ ┌─────────────┬───────┬─────────────┐   │
│ │   Setting   │ Defau │ Recommended │   │
│ │             │  lt   │             │   │
│ ├─────────────┼───────┼─────────────┤   │
│ │ JWT expiry  │ 3600s │ Keep — auto │   │
│ │ (access     │       │ -refreshes  │   │
│ │ token)      │ (1hr) │             │   │
│ ├─────────────┼───────┼─────────────┤   │
│ │ Refresh     │ 60480 │ Increase to │   │
│ │ token       │ 0s (7 │  2592000s   │   │
│ │ lifetime    │       │ (30 days)   │   │
│ │             │ days) │             │   │
│ ├─────────────┼───────┼─────────────┤   │
│ │             │ 600s  │             │   │
│ │ OTP expiry  │ (10   │ Keep        │   │
│ │             │ min)  │             │   │
│ ├─────────────┼───────┼─────────────┤   │
│ │ Enable      │       │             │   │
│ │ email confi │ On    │ Keep on     │   │
│ │ rmations    │       │             │   │
│ ├─────────────┼───────┼─────────────┤   │
│ │ Double      │       │             │   │
│ │ confirm     │ On    │ Keep on     │   │
│ │ email       │       │             │   │
│ │ changes     │       │             │   │
│ └─────────────┴───────┴─────────────┘   │
│                                         │
│ 3c. Session expiry toast                │
│                                         │
│ File: src/contexts/AuthContext.tsx      │
│                                         │
│ In the onAuthStateChange listener, add  │
│ a toast when the user gets signed out   │
│ unexpectedly:                           │
│                                         │
│ // Inside the onAuthStateChange         │
│ callback:                               │
│ if (event === 'SIGNED_OUT' && prevUser  │
│ !== null) {                             │
│   // Only show toast if user was        │
│ previously logged in (not on initial    │
│ load)                                   │
│   toast.info('Byli jste odhlášeni.      │
│ Přihlaste se znovu.')                   │
│ }                                       │
│                                         │
│ This requires importing toast from      │
│ sonner and tracking previous user       │
│ state.                                  │
│                                         │
│ ---                                     │
│ Step 4: Fix Branches                    │
│                                         │
│ Current state                           │
│                                         │
│ The seed data has 3 branches: Praha,    │
│ Brno, Olomouc. The user said "I have    │
│ not created them correctly."            │
│                                         │
│ What to fix                             │
│                                         │
│ The user needs to update                │
│ sql/04_seed.sql with the correct branch │
│  names and cities for their real        │
│ Psychočas chapters. Then re-run the     │
│ seed SQL:                               │
│                                         │
│ cd desing                               │
│ SUPABASE_ACCESS_TOKEN='<REDACTED>' \    │
│ npx supabase db query --linked -f       │
│ sql/04_seed.sql                         │
│                                         │
│ The seed uses ON CONFLICT ... DO UPDATE │
│  so it's safe to re-run — it will       │
│ update existing rows, not create        │
│ duplicates.                             │
│                                         │
│ Branch ID references                    │
│                                         │
│ If branch UUIDs change, update all      │
│ references:                             │
│ - 04_seed.sql — whitelist entries       │
│ reference branch_id                     │
│ - 04_seed.sql — partners reference      │
│ branch_id                               │
│ - Any test users' branch_id in the      │
│ whitelist                               │
│                                         │
│ ---                                     │
│ Step 5: Create Test Users for Manual    │
│ Login                                   │
│                                         │
│ The problem                             │
│                                         │
│ .test domain emails can't receive real  │
│ OTP emails from Supabase. We need a way │
│  to actually log in as                  │
│ member/board/technician.                │
│                                         │
│ Solution: Dev-only password login       │
│                                         │
│ 5a. Create                              │
│ desing/scripts/setup-test-users.ts      │
│                                         │
│ This script uses the Supabase service   │
│ role key (admin access) to create auth  │
│ users with passwords:                   │
│                                         │
│ // Run with: npx tsx                    │
│ scripts/setup-test-users.ts             │
│ // Requires: SUPABASE_URL and           │
│ SUPABASE_SERVICE_ROLE_KEY env vars      │
│                                         │
│ import { createClient } from            │
│ '@supabase/supabase-js'                 │
│                                         │
│ const supabaseUrl =                     │
│ process.env.SUPABASE_URL || 'https://ws │
│ gmbtcsyccnzfenfucl.supabase.co'         │
│ const serviceRoleKey =                  │
│ process.env.SUPABASE_SERVICE_ROLE_KEY   │
│                                         │
│ if (!serviceRoleKey) {                  │
│   console.error('Set                    │
│ SUPABASE_SERVICE_ROLE_KEY env var       │
│ (Dashboard → Settings → API →           │
│ service_role)')                         │
│   process.exit(1)                       │
│ }                                       │
│                                         │
│ const supabase =                        │
│ createClient(supabaseUrl,               │
│ serviceRoleKey, {                       │
│   auth: { autoRefreshToken: false,      │
│ persistSession: false },                │
│ })                                      │
│                                         │
│ const testUsers = [                     │
│   { email: 'clen@psychocas.test',       │
│ password: 'TestPsychocas2026!' },       │
│   { email: 'vybor@psychocas.test',      │
│ password: 'TestPsychocas2026!' },       │
│   { email: 'technik@psychocas.test',    │
│ password: 'TestPsychocas2026!' },       │
│ ]                                       │
│                                         │
│ for (const u of testUsers) {            │
│   // Delete existing user if any        │
│   const { data: existing } = await      │
│ supabase.auth.admin.listUsers()         │
│   const existingUser =                  │
│ existing?.users?.find(usr => usr.email  │
│ === u.email)                            │
│   if (existingUser) {                   │
│     await supabase.auth.admin.deleteUse │
│ r(existingUser.id)                      │
│     console.log(`Deleted existing:      │
│ ${u.email}`)                            │
│   }                                     │
│                                         │
│   // Create with confirmed email +      │
│ password                                │
│   const { data, error } = await         │
│ supabase.auth.admin.createUser({        │
│     email: u.email,                     │
│     password: u.password,               │
│     email_confirm: true,                │
│   })                                    │
│                                         │
│   if (error) {                          │
│     console.error(`FAILED ${u.email}:`, │
│  error.message)                         │
│   } else {                              │
│     console.log(`Created ${u.email} →   │
│ auth.users.id = ${data.user.id}`)       │
│   }                                     │
│ }                                       │
│                                         │
│ console.log('\nNow log in to the app    │
│ with each test email.')                 │
│ console.log('The app will auto-create   │
│ member profiles from the whitelist.')   │
│ console.log('Then run the role UPDATE   │
│ statements from 04_seed.sql.')          │
│                                         │
│ 5b. Run the script                      │
│                                         │
│ cd desing                               │
│ SUPABASE_SERVICE_ROLE_KEY='<get from    │
│ Dashboard → Settings → API →            │
│ service_role key>' \                    │
│ npx tsx scripts/setup-test-users.ts     │
│                                         │
│ The service role key is at:             │
│ https://supabase.com/dashboard/project/ │
│ wsgmbtcsyccnzfenfucl/settings/api       │
│ (scroll to service_role — it's the      │
│ secret one, NOT the anon key).          │
│                                         │
│ 5c. Add dev-only password login to      │
│ LoginPage                               │
│                                         │
│ File: src/pages/LoginPage.tsx           │
│                                         │
│ Add a password state and conditional    │
│ UI:                                     │
│                                         │
│ const [password, setPassword] =         │
│ useState('')                            │
│                                         │
│ // In handleEmailSubmit, add password   │
│ path:                                   │
│ async function handleEmailSubmit(e:     │
│ React.FormEvent) {                      │
│   e.preventDefault()                    │
│   setLoading(true)                      │
│                                         │
│   // DEV ONLY: .test emails use         │
│ password auth                           │
│   if (import.meta.env.DEV &&            │
│ email.endsWith('@psychocas.test') &&    │
│ password) {                             │
│     const { error } = await             │
│ supabase.auth.signInWithPassword({      │
│ email, password })                      │
│     setLoading(false)                   │
│     if (error) {                        │
│       toast.error('Chyba přihlášení: '  │
│ + error.message)                        │
│     } else {                            │
│       navigate('/')                     │
│     }                                   │
│     return                              │
│   }                                     │
│                                         │
│   // Normal OTP flow                    │
│   const { error } = await signIn(email) │
│   setLoading(false)                     │
│   if (error) {                          │
│     toast.error(error)                  │
│   } else {                              │
│     setStep('otp')                      │
│     toast.success('Kód byl odeslán na   │
│ váš email')                             │
│   }                                     │
│ }                                       │
│                                         │
│ Add the password field in the email     │
│ form (only in dev mode):                │
│ {/* After the email input, before the   │
│ submit button: */}                      │
│ {import.meta.env.DEV &&                 │
│ email.endsWith('@psychocas.test') && (  │
│   <div className="space-y-3 text-left"> │
│     <Label htmlFor="password" style={{  │
│ color: '#f57c00' }}>                    │
│       🔧 DEV: Test heslo                │
│     </Label>                            │
│     <Input                              │
│       id="password"                     │
│       type="password"                   │
│       value={password}                  │
│       onChange={(e) =>                  │
│ setPassword(e.target.value)}            │
│       placeholder="TestPsychocas2026!"  │
│       disabled={loading}                │
│     />                                  │
│   </div>                                │
│ )}                                      │
│                                         │
│ Also import supabase at the top:        │
│ import { supabase } from                │
│ '@/lib/supabase'                        │
│                                         │
│ Security: import.meta.env.DEV is true   │
│ only during npm run dev. Vite           │
│ completely removes this code from       │
│ production builds (npm run build).      │
│ Verify with: npm run build && grep -r   │
│ "psychocas.test" dist/ — should return  │
│ nothing.                                │
│                                         │
│ 5d. After first login, assign roles via │
│  SQL                                    │
│                                         │
│ After each test user logs in once       │
│ (which creates their members row        │
│ automatically), run:                    │
│                                         │
│ -- Run via Supabase CLI or SQL Editor:  │
│ UPDATE public.members SET role =        │
│ 'board'      WHERE email =              │
│ 'vybor@psychocas.test';                 │
│ UPDATE public.members SET role =        │
│ 'technician' WHERE email =              │
│ 'technik@psychocas.test';               │
│ -- clen@psychocas.test stays as         │
│ 'member' (default)                      │
│                                         │
│ CLI command:                            │
│ SUPABASE_ACCESS_TOKEN='<REDACTED>' \    │
│ npx supabase db query --linked \        │
│ "UPDATE public.members SET role =       │
│ 'board' WHERE email =                   │
│ 'vybor@psychocas.test'; UPDATE          │
│ public.members SET role = 'technician'  │
│ WHERE email =                           │
│ 'technik@psychocas.test';"              │
│                                         │
│ 5e. Test the real email                 │
│ (bunnik.matias@seznam.cz)               │
│                                         │
│ This is the user's own email — it       │
│ receives real OTP emails from Supabase. │
│  Test the full flow:                    │
│ 1. Go to /login                         │
│ 2. Enter bunnik.matias@seznam.cz        │
│ 3. Check inbox for 6-digit code         │
│ 4. Enter code → should log in           │
│ 5. After first login, assign role:      │
│ UPDATE public.members SET role =        │
│ 'technician' WHERE email =              │
│ 'bunnik.matias@seznam.cz';              │
│                                         │
│ ---                                     │
│ Step 6: Create Test Discounts           │
│                                         │
│ Discounts require created_by →          │
│ members.id. After your admin account    │
│ exists (Step 5e), get your member ID    │
│ and create discounts:                   │
│                                         │
│ -- Get your member ID:                  │
│ SELECT id FROM public.members WHERE     │
│ email = 'bunnik.matias@seznam.cz';      │
│                                         │
│ -- Insert discounts (replace            │
│ <YOUR_ID>):                             │
│ INSERT INTO public.discounts            │
│ (partner_id, title, discount_value,     │
│ is_active, created_by) VALUES           │
│   ('a0000000-0000-0000-0000-00000000000 │
│ 1', '10 % sleva na psychologickou       │
│ literaturu', '10 %',   true,            │
│ '<YOUR_ID>'),                           │
│   ('a0000000-0000-0000-0000-00000000000 │
│ 2', '3 měsíce zdarma',                  │
│        'zdarma', true, '<YOUR_ID>'),    │
│   ('a0000000-0000-0000-0000-00000000000 │
│ 3', '15 % na všechny nápoje',           │
│        '15 %',   true, '<YOUR_ID>'),    │
│   ('a0000000-0000-0000-0000-00000000000 │
│ 4', 'První lekce zdarma',               │
│        'zdarma', true, '<YOUR_ID>'),    │
│   ('a0000000-0000-0000-0000-00000000000 │
│ 5', '20 % na wellness balíček',         │
│        '20 %',   true, '<YOUR_ID>');    │
│                                         │
│ Or use the ManagePage UI after logging  │
│ in as a manager/board/technician.       │
│                                         │
│ ---                                     │
│ Step 7: Manual QA Checklist             │
│                                         │
│ Build & Lint                            │
│                                         │
│ - npm run lint — passes (warnings OK,   │
│ no errors)                              │
│ - npm run build — zero TypeScript       │
│ errors, Vite builds successfully        │
│ - npm run test — 29/29 tests pass       │
│ - npm run build && grep -r              │
│ "psychocas.test" dist/ — returns        │
│ nothing (dev code stripped)             │
│                                         │
│ Auth Flow                               │
│                                         │
│ - Login with real email                 │
│ (bunnik.matias@seznam.cz) — receives    │
│ OTP, enters code, logs in               │
│ - Login with test member                │
│ (clen@psychocas.test + password) — dev  │
│ mode only                               │
│ - Login with test board                 │
│ (vybor@psychocas.test + password) — dev │
│  mode only                              │
│ - Login with test technician            │
│ (technik@psychocas.test + password) —   │
│ dev mode only                           │
│ - Non-whitelisted email shows: "Váš     │
│ email není registrován..."              │
│ - Deactivated email                     │
│ (neaktivni@psychocas.test) shows: "Váš  │
│ účet byl deaktivován..."                │
│ - Wrong OTP code shows error and clears │
│  input                                  │
│ - OTP auto-submits on 6th digit (no     │
│ need to click button)                   │
│ - OTP paste works (copy "123456", paste │
│  into input)                            │
│ - Mobile: numeric keyboard appears for  │
│ OTP input                               │
│                                         │
│ Session Persistence                     │
│                                         │
│ - After login, refresh page → still     │
│ logged in                               │
│ - Close browser, reopen → still logged  │
│ in                                      │
│ - Sign out → redirects to /login        │
│ - After sign out, pressing back doesn't │
│  show authenticated content             │
│                                         │
│ Role-Based Access                       │
│                                         │
│ - Member sees: homepage, discounts,     │
│ token generation                        │
│ - Member does NOT see: manage, stats    │
│ links                                   │
│ - Board sees: homepage, discounts, +    │
│ manage & stats links                    │
│ - Technician sees: same as board (full  │
│ access)                                 │
│ - Direct URL /manage as member →        │
│ redirects to /                          │
│ - Direct URL /stats as member →         │
│ redirects to /                          │
│                                         │
│ Feature Checks                          │
│                                         │
│ - Discounts page shows partner          │
│ discounts grouped correctly             │
│ - Membership status badge shows         │
│ "Aktivní" / "Neaktivní" correctly       │
│ - Expired membership                    │
│ (vyprsel@psychocas.test) shows          │
│ "Neaktivní"                             │
│ - ManagePage: can add a partner, can    │
│ add a discount                          │
│ - StatsPage: loads without errors (may  │
│ show empty state if no redemptions)     │
│ - Token generation: calls Edge          │
│ Function, shows QR code + countdown     │
│ - Validation page (/v/:hash): shows     │
│ correct status after scanning QR        │
│                                         │
│ ---                                     │
│ File Summary                            │
│                                         │
│ File: eslint.config.js                  │
│ Action: CREATE                          │
│ What: ESLint v9 flat config             │
│ ─────────────────────────────────────── │
│ ─                                       │
│ File: package.json                      │
│ Action: EDIT                            │
│ What: Add lint and lint:fix scripts     │
│ ─────────────────────────────────────── │
│ ─                                       │
│ File: src/pages/LoginPage.tsx           │
│ Action: EDIT                            │
│ What: Add REGEXP_ONLY_DIGITS,           │
│ onComplete                              │
│   auto-submit, dev-only password field  │
│ ─────────────────────────────────────── │
│ ─                                       │
│ File: src/components/ui/input-otp.tsx   │
│ Action: EDIT                            │
│ What: Increase slot size h-9→h-12,      │
│   w-9→w-12                              │
│ ─────────────────────────────────────── │
│ ─                                       │
│ File: src/lib/supabase.ts               │
│ Action: EDIT                            │
│ What: Add detectSessionInUrl: false     │
│ ─────────────────────────────────────── │
│ ─                                       │
│ File: src/contexts/AuthContext.tsx      │
│ Action: EDIT                            │
│ What: Add session expiry toast          │
│ ─────────────────────────────────────── │
│ ─                                       │
│ File: scripts/setup-test-users.ts       │
│ Action: CREATE                          │
│ What: Admin API script to create test   │
│ auth                                    │
│   users                                 │
│ ─────────────────────────────────────── │
│ ─                                       │
│ File: sql/04_seed.sql                   │
│ Action: EDIT                            │
│ What: Fix branch names/cities if needed │
│                                         │
│ ---                                     │
│ Execution Order                         │
│                                         │
│ 1. ESLint setup + lint fix              │
│        (independent)                    │
│ 2. OTP input hardening                  │
│        (independent)                    │
│ 3. Session config (supabase.ts +        │
│ dashboard)   (independent)              │
│ 4. Fix branches in seed SQL + re-run    │
│        (independent)                    │
│ 5. Create test users script + run it    │
│        (needs service role key)         │
│ 6. Add dev-only password login to       │
│ LoginPage   (after step 5)              │
│ 7. Log in as each user, assign roles    │
│ via SQL  (after step 6)                 │
│ 8. Create test discounts                │
│        (after step 7)                   │
│ 9. Full manual QA checklist             │
│        (after all above)                │
│                                         │
│ Steps 1–4 can be done in parallel.      │
│ Steps 5–9 are sequential.               │
╰─────────────────────────────────────────╯
```
