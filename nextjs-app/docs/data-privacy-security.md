# Data, soukromí a bezpečnost

Aktualizováno: 18. 7. 2026

Tento dokument popisuje implementované technické kontroly. Není právním stanoviskem ani sám o sobě neprohlašuje organizaci za plně GDPR compliant.

## Datový model podle domén

### Identita a přístup

| Tabulka | Účel |
|---|---|
| `users` | Technická auth identita spravovaná Convex Auth. |
| `accessGrants` | Allowlist, jméno, email, role, pobočka, stav a platnost členství. |
| `otpRequestLimits` | Omezení frekvence OTP požadavků. |
| `systemRateLimits` | Deployment-wide rozpočet OTP požadavků bez IP nebo identity zařízení. |
| `members` | Vazba přihlášené identity na access grant a členský profil. |
| `organizations` | Kořen organizačního scope. |
| `staffAssignments` | Staff preset, organization/branch scope, stav a platnost. |
| `branches` | Pobočky Psychočasu. |

### Partneři a nabídky

| Tabulka | Účel |
|---|---|
| `partners` | Partner, kategorie, web, popis, adresa a scope. |
| `campaigns` | Sezónní nebo komunikační seskupení obsahu. |
| `offers` | Nabídka, hodnota, instrukce, podmínky, scope, lifecycle a platnost. |
| `approvalRequests` | Dohledatelné schválení publikace. |
| `offerFavorites` | Explicitně uložené oblíbené nabídky člena. |
| `offerIssueReports` | Hlášení kvality nabídky a jeho workflow. |
| `redemptionFeedback` | Jednorázová zkušenost po použití QR. |

### QR a analytika

| Tabulka | Účel |
|---|---|
| `tokens` | Hash secreta a short code, member/offer vazba, stav a expirace. |
| `tokenEvents` | Krátkodobé technické události QR. |
| `analyticsDaily` | Denní agregace podle pobočky, partnera a nabídky. |

### Komunikace, eventy a accountability

| Tabulka | Účel |
|---|---|
| `feedback` | Obecná zpětná vazba člena. |
| `partnerSuggestions` | Návrhy partnerů a review workflow. |
| `pushSubscriptions` | Web Push endpoint a kryptografické public údaje zařízení. |
| `deliveryJobs` | Fronta a výsledek doručení kampaně. |
| `notificationPreferences` | Explicitní preference témat. |
| `events` | Události v national/local scope. |
| `eventCheckIns` | Odbavení člena na konkrétní události. |
| `auditLogs` | Minimální audit citlivých změn. |
| `privacyRequests` | Workflow práv subjektu údajů. |
| `retentionRuns` | Doklad běhu cleanup/anonymizace. |

Aktuální validátory, indexy a optional pole jsou vždy v `convex/schema.ts`.

## Minimalizace dat

- Veřejné QR nezobrazuje jméno, email, pobočku ani přesné datum členství.
- Aplikační tabulky QR neukládají raw IP.
- OTP ochrana kombinuje limit na allowlistovaný email a globální rozpočet; neukládá IP adresu.
- QR secret ani short code se neukládají čitelně.
- Management metriky jsou agregované a neobsahují členský leaderboard.
- Support adresář nevrací historii nabídek ani QR použití.
- Issue fronta nevrací identitu autora hlášení.
- Push payload nesmí obsahovat citlivé údaje vhodné pro profilování na lock screenu.
- Volné texty mají délkové limity a UI upozorňuje nevkládat citlivé osobní údaje.
- Zdrojový CSV soubor členů se parsuje v prohlížeči a neukládá se; Convex dostane pouze validované strukturované řádky a do auditu zapisuje jen souhrn importu.

## Implementovaná retence

Denní Convex cron běží ve `02:35 UTC` a volá `retention.runOperationalCleanup`.

| Kategorie | Implementované pravidlo |
|---|---|
| OTP rate-limit záznam | Smazání po 24 hodinách neaktivity. |
| `tokenEvents` | Smazání po 30 dnech. |
| Expirované/redeemed/revoked tokeny | Smazání po 31 dnech, pokud už nemají token event. |
| `deliveryJobs` ve finálním stavu | Smazání po 90 dnech. |
| `redemptionFeedback` | Po 90 dnech odstranění `memberId` a `tokenId`; agregovaná zkušenost zůstává. |
| `offerIssueReports` | Po 90 dnech odstranění `memberId`; obsah a stav mohou zůstat pro nápravu nabídky. |
| Oblíbené nabídky | Zůstávají u účtu do odebrání členem nebo vyřízení výmazu účtu. |

Cleanup zpracovává omezené dávky. Každý běh zapisuje počty zpracovaných, smazaných a anonymizovaných záznamů do `retentionRuns`.

## GDPR self-service

Člen má v profilu:

- export strukturovaných osobních údajů,
- změnu notification preferences,
- access request,
- correction request,
- deletion request,
- restriction request,
- objection request,
- veřejné informace na `/privacy`.

Oprávněná osoba zpracovává žádosti ve workspace. Aplikace automaticky nerozhoduje, zda lze konkrétní data vymazat.

## PWA a cache kontrakt

Service worker nikdy necachuje:

- `/api/auth`,
- `/login`,
- `/home`,
- `/admin`,
- `/workspace`,
- `/privacy`,
- `/v` a jeho podcesty.

Navigace je network-first bez ukládání personalizovaného dokumentu a při výpadku dostane pouze obecný `offline.html`. Cache může obsahovat Next.js statické chunky, obrázky, fonty, manifest a brand assety.

Členský IndexedDB snapshot:

- má verzi a expiraci 24 hodin,
- obsahuje stav členství, pobočku a omezený snapshot publikovaných nabídek,
- může obsahovat explicitní stav oblíbení pro offline zobrazení,
- neobsahuje OTP, session, aktivní QR secret, short code ani historii skenů,
- maže se při logoutu.

Offline snapshot je informativní. QR nelze offline vytvořit ani autoritativně ověřit.

## Kryptografie a secrets

Convex deployment používá serverové proměnné:

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

Pravidla:

- secrets nikdy nepoužívat s prefixem `NEXT_PUBLIC_`,
- neukládat je do `.env.local`, Git historie, issue, PR ani chatu,
- development a production mají jiné JWT, QR pepper a VAPID klíče,
- `SITE_URL` musí přesně odpovídat frontend originu,
- po podezření na únik klíč okamžitě rotovat, ne pouze smazat z posledního commitu,
- provisioning helper předává secrets do Convexu bez jejich vypsání.

## Serverová autorizace

Frontendová kontrola viditelnosti není ochrana. Každá chráněná query/mutation/action volá `requireActiveMember` nebo `requireCapability`. Scope se porovnává se zdrojem v databázi.

Kritické příklady:

- member nemůže volat management mutace,
- branch assignment nemůže měnit cizí pobočku,
- neaktivní nebo expirovaný access grant zablokuje členskou operaci,
- QR validace znovu kontroluje aktuální členství, nabídku i partnera,
- jeden token má jen jeden first valid scan,
- jeden token přijme jen jeden redemption feedback.

## Security hlavičky

Next.js nastavuje mimo jiné:

- Content-Security-Policy,
- Strict-Transport-Security,
- `X-Frame-Options: DENY`,
- `X-Content-Type-Options: nosniff`,
- restrictive Permissions-Policy,
- `no-store` pro auth, protected, privacy a QR routy,
- striktní hlavičky a scope pro `/sw.js`.

## Organizační kroky mimo kód

Před a během pilotu musí odpovědná osoba řešit také:

- právní tituly a záznamy činností zpracování,
- DPA a subprocesory Convexu, Vercelu a Resendu,
- schválený retenční plán,
- DPIA/risk screening zejména u citlivých kategorií partnerů,
- incident a breach proces,
- školení boardu, supportu a koordinátorů,
- proces ověření a dokončení privacy requests.
