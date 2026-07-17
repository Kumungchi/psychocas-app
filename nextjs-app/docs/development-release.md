# Vývoj a release

Aktualizováno: 17. 7. 2026

Všechny příkazy v tomto dokumentu se spouštějí z `nextjs-app/`.

## Požadavky

- Node.js a npm,
- přístup k development Convex projektu,
- development Convex server secrets,
- pro plný login test ověřený email v access grants,
- Chromium pro Playwright browser suite.

## První lokální spuštění

```powershell
npm install
Copy-Item .env.local.example .env.local
npm run convex:dev
npm run dev
```

`npm run convex:dev` propojí lokální kód s vybraným development deploymentem a průběžně nahrává backend změny. `npm run dev` spustí Next.js na `http://localhost:3000`.

Do `.env.local` patří jen public URL a neškodná veřejná konfigurace:

```env
CONVEX_DEPLOYMENT=dev:your-convex-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-convex-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-convex-deployment.convex.site
NEXT_PUBLIC_PRIVACY_CONTACT=info@psychocas.cz
```

Backend secrets patří do Convex environmentu. Jejich názvy jsou v [Data, soukromí a bezpečnost](data-privacy-security.md).

## Příkazy

| Příkaz | Účel |
|---|---|
| `npm run dev` | Next.js development server. Service worker se v dev režimu neregistruje. |
| `npm run convex:dev` | Sleduje a nahrává Convex development backend. |
| `npm run convex:codegen` | Vygeneruje API typy bez Convex typechecku. |
| `npm run lint` | ESLint. |
| `npm test` | Všechny Vitest a Convex integration testy. |
| `npm run build` | Lokální produkční Next.js build s TypeScriptem. |
| `npm run test:vercel` | Čistý Vercel-like build a kontrola produkčního Convex fallbacku/PWA artefaktů. |
| `npm run verify` | Lint, testy a `test:vercel`. |
| `npm run test:browser` | Playwright kontrola proti běžícímu produkčnímu buildu nebo URL. |
| `npm run screenshots` | Screenshoty veřejných produktových rout. |
| `npm run convex:deploy` | Produkční Convex deploy s codegenem a typecheckem. |
| `npm run convex:provision -- --prod` | Bezpečné provision produkčních JWT/QR/VAPID proměnných. |

## Doporučený vývojový cyklus

1. Přečíst relevantní docs a existující modul.
2. U backend změny nejdříve upravit `convex/schema.ts` a doménové API.
3. Doplnit serverovou authorization kontrolu.
4. Doplnit integrační test pro allow i deny scénář.
5. Upravit UI a CZ/EN texty.
6. Aktualizovat GDPR export/retenci, pokud vzniká nové osobní nebo provozní datum.
7. Aktualizovat dokumentaci.
8. Spustit `npm run verify`.
9. Pro PWA/UI změnu spustit produkční browser suite.

## Testovací vrstvy

### Unit a integration

`npm test` pokrývá:

- auth membership a permissions model,
- management edit flow,
- oblíbené, hlášení, QR feedback a retenční anonymizaci,
- QR hash a veřejný redemption flow,
- analytické agregace,
- PWA snapshot/display mode,
- routing, locale a utility funkce.

### Vercel-like build

`npm run test:vercel`:

- odstraní existující `.next`,
- sestaví aplikaci v `NODE_ENV=production` a Vercel-like prostředí,
- zkontroluje `BUILD_ID`,
- ověří produkční Convex fallback v bundle,
- ověří service worker, offline fallback a vyloučení citlivých rout,
- po doběhnutí `.next` standardně odstraní.

Proto po `npm run verify` spusť `npm run build` znovu, pokud chceš lokálně použít `npm run start`. Pro zachování build artefaktu lze jednorázově nastavit `KEEP_NEXT_BUILD=true`.

### Browser/PWA suite

```powershell
npm run build
npm run start
npm run test:browser
```

Test ověřuje mobilní viewporty od 320 px, veřejné routy, redirect chráněných rout, odstraněné demo routy, install walkthrough, offline/reconnect, locale, service worker, private-cache exclusion, manifest a bezpečnostní hlavičky.

Pro produkci:

```powershell
$env:PSYCHOCAS_BASE_URL='https://app.psychocas.cz'
npm run test:browser
Remove-Item Env:PSYCHOCAS_BASE_URL
```

`PSYCHOCAS_TEST_EMAIL` je volitelný a browser suite s ním pouze ověří přijetí OTP requestu; automaticky nečte emailovou schránku.

## Produkční release

Backend a frontend jsou dva samostatné deploymenty. Povinné pořadí je backend první.

### 1. Release gate

```powershell
npm run verify
npm audit --omit=dev
npx tsc -p convex/tsconfig.json --noEmit
```

### 2. Convex

```powershell
npm run convex:deploy
npx convex function-spec --prod
```

Zkontrolovat production env pouze podle názvů, nikdy nevypisovat hodnoty do logu nebo PR.

### 3. Vercel

- Vercel Root Directory musí být `nextjs-app`.
- `vercel.json` používá `npm run build`.
- Produkční public Convex URL musí směřovat na production deployment.
- Push do propojené produkční větve spustí frontend deploy, pokud je GitHub integrace aktivní.

### 4. Produkční smoke test

1. Otevřít `/`, `/login`, `/privacy` a `/v`.
2. Přihlásit testovacího aktivního člena.
3. Ověřit nabídky, oblíbení a detail.
4. Vytvořit QR a naskenovat ho druhým telefonem.
5. Ověřit realtime success a post-redemption feedback.
6. Ověřit board workspace a scope.
7. Spustit `test:browser` proti custom doméně.

## Rollback

- Frontend: ve Vercelu promovat poslední známý funkční deployment nebo revertovat release commit novým commitem.
- Backend: Convex změny navrhovat zpětně kompatibilně; destruktivní schema změnu nenasazovat společně s frontendem bez migračního období.
- Obsahový incident: pozastavit konkrétní nabídku nebo archivovat partnera místo redeploye.
- Přístupový incident: zneaktivnit/revokovat access grant a staff assignment; citlivé backend operace okamžitě začnou selhávat.
- Secret incident: rotovat kompromitovaný secret a redeploynout závislé části.

Po rollbacku vždy zopakovat relevantní smoke a browser test.

## Git pravidla

- Necommitovat `.env*`, logy, produkční exporty ani secrets.
- Generated Convex API typy commitovat společně se změnou backend API.
- Neslučovat nesouvisející refaktory s urgentním opravným releasem.
- Commit musí obsahovat test a dokumentaci pro novou behaviorální nebo datovou plochu.
