# Dokumentace Psychočas PWA

Aktualizováno: 18. 7. 2026

Tento adresář je autoritativní technická a produktová dokumentace aktivní aplikace v `nextjs-app/`. Popisuje aktuální stav po přechodu na Convex. Starší dokumenty o Supabase jsou historické a nesmí se používat jako návod pro současný runtime.

## Rychlá orientace

| Potřebuji zjistit | Dokument |
|---|---|
| Co aplikace umí a kdo ji používá | [Produkt a role](product-and-roles.md) |
| Jak spolu souvisejí Next.js, Convex, auth a PWA | [Architektura](architecture.md) |
| Jak funguje login, nabídky, QR, hlášení a schvalování | [Hlavní workflow](workflows.md) |
| Jaká data ukládáme a jak řešíme bezpečnost a GDPR | [Data, soukromí a bezpečnost](data-privacy-security.md) |
| Jak aplikaci spustit, testovat a nasadit | [Vývoj a release](development-release.md) |
| Co kontrolovat v pilotu a jak reagovat na incident | [Provozní runbook](operations-runbook.md) |
| Jak nastavit CI/CD, rotovat klíče a ověřit obnovu | [Security a recovery runbook](security-recovery-runbook.md) |

## Aplikace jednou větou

Psychočas je mobile-first členská PWA, ve které člen najde národní a lokální výhody, vytvoří jednorázový QR kód a partner ho ověří běžným telefonem bez účtu; board, manažeři a koordinátoři spravují obsah v rozsahu svých oprávnění.

## Mapa uživatelských povrchů

| URL | Přístup | Účel |
|---|---|---|
| `/` | veřejný | Stručné představení produktu; přihlášený uživatel je přesměrován na `/home`. |
| `/login` | veřejný | Přihlášení osmimístným emailovým OTP. |
| `/home` | aktivní člen | Členství, discovery nabídek, QR karta, události, profil a soukromí. |
| `/workspace` | staff s odpovídající capability | Partneři, nabídky, hlášení, kampaně, eventy, approvals, metriky a privacy fronta. |
| `/admin` | board/admin s `membership.manage` | Členové, pobočky a staff assignments. |
| `/v` | veřejný | Ověření QR nebo ručního osmimístného kódu bez zobrazení identity člena. |
| `/privacy` | veřejný | Informace o zpracování údajů a retenčních pravidlech. |
| `/api/health` | veřejný monitoring | Minimální stav webu, Convexu a čerstvosti retence bez osobních údajů. |

## Zdroj pravdy

Při rozporu dokumentace a implementace platí toto pořadí:

1. serverová autorizace v `convex/authz.ts` a `convex/permissions.ts`,
2. datový model v `convex/schema.ts`,
3. veřejné Convex funkce a HTTP actions,
4. tato dokumentace,
5. historické plány a migrační dokumenty.

UI nikdy není bezpečnostní hranice. Skryté tlačítko pouze zlepšuje UX; každá chráněná operace musí být odmítnuta nebo povolena Convexem.

## Aktivní technologie

- Next.js App Router a React
- Convex jako jediný runtime backend a databáze
- Convex Auth s osmimístným OTP
- Resend pouze pro doručení OTP emailu
- Vercel pro hosting Next.js aplikace
- vlastní service worker a IndexedDB snapshot pro PWA
- Vitest, `convex-test` a Playwright pro ověření

Supabase není součástí aktivního runtime.

## Údržba dokumentace

Změna schématu, capability, workflow, retenční doby, PWA cache kontraktu nebo release postupu musí ve stejném commitu aktualizovat odpovídající dokument. Dokumentace nesmí obsahovat privátní klíče, OTP, export členů ani produkční deployment key.
