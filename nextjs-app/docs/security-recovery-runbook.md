# Security a recovery runbook

Aktualizováno: 18. 7. 2026

Tento postup je určen technickému správci. Hodnoty secrets, OTP, exporty a identitu členů nikdy nevkládat do GitHub issues, Actions logů, dokumentace ani chatu.

## Jednorázové nastavení GitHubu a Vercelu

1. V GitHubu vytvořit environment `production` a omezit jeho správu na technického správce a určeného zástupce boardu.
2. Do environmentu přidat `CONVEX_DEPLOY_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID` a `VERCEL_PROJECT_ID`.
3. Zapnout required reviewers pro environment `production`.
4. Na větvi `main` vyžadovat úspěšné kontroly `Lint, tests, security, and Convex types`, `Vercel-like production build` a `JavaScript and TypeScript analysis`.
5. Ve Vercelu ponechat jediný projekt, který vlastní `app.psychocas.cz`; ověřit Root Directory `nextjs-app` a produkční Convex URL.
6. Až po úspěšném ručním běhu workflow `Production release` vypnout automatický production deploy z Vercel Git integration. Preview deploymenty mohou zůstat aktivní.
7. Druhý historický Vercel projekt nejdříve odpojit od GitHubu a domén, potom archivovat nebo odstranit.

Workflow nasazuje Convex dříve než frontend a po nasazení kontroluje `https://app.psychocas.cz/api/health`. Produkční release se nesmí spouštět současně; GitHub concurrency to blokuje.

## Rotace klíčů

Rotaci provádět po jednom secretu a vždy ověřit login, QR nebo deployment podle jeho účelu.

### Resend

1. V Resendu vytvořit nový sending-only API key.
2. Nastavit nový `AUTH_RESEND_KEY` nejdříve v development Convexu a otestovat OTP.
3. Nastavit jej v produkčním Convexu, odeslat OTP na vyhrazený testovací účet a dokončit přihlášení.
4. Teprve po úspěšném testu revokovat původní Resend key.

### Convex deploy key

1. Vytvořit nový production deploy key určený pouze pro GitHub Actions.
2. Aktualizovat GitHub environment secret `CONVEX_DEPLOY_KEY`.
3. Spustit `Production release` nad aktuálním commitem a ověřit health endpoint.
4. Revokovat původní deploy key. Development a production musí mít rozdílné klíče.

### JWT a JWKS

1. Naplánovat krátké servisní okno; rotace může odhlásit existující session.
2. Vygenerovat nový pár pomocí `npm run convex:auth-keys` mimo logovaný terminál a historii shellu.
3. Nastavit `JWT_PRIVATE_KEY` a `JWKS` jako jeden koordinovaný pár v cílovém Convex deploymentu.
4. Ověřit nový OTP login, obnovení stránky a odhlášení.
5. Starý privátní klíč bezpečně odstranit z dočasného úložiště.

Po rotaci všech dříve sdílených secrets odstranit `BOOTSTRAP_ADMIN_EMAILS` z produkce, pokud už existuje aktivní board/admin přístup. Bootstrap není dlouhodobý access-management mechanismus.

## Backup

Produkční export obsahuje osobní údaje a nesmí se ukládat jako GitHub Actions artifact.

```powershell
New-Item -ItemType Directory -Force .backups | Out-Null
npx convex export --prod --include-file-storage --path .backups/psychocas-2026-07-18.zip
```

Export okamžitě přenést do schváleného šifrovaného úložiště s omezeným přístupem. Lokální kopii po ověření přenosu bezpečně odstranit podle interního retenčního postupu. Název, čas, vlastník a výsledek exportu se evidují bez obsahu exportu.

## Restore drill

1. Použít izolovaný development/test Convex projekt, nikdy aktivní development sdílený s pilotem.
2. Naimportovat poslední schválený export podle aktuální Convex dokumentace.
3. Ověřit počty hlavních tabulek, vazby access grant/member, nabídky a auditní/retention záznamy.
4. Neposílat emaily ani push notifikace z obnoveného prostředí; provider keys v test projektu musí být vypnuté nebo testovací.
5. Zapsat datum, dobu obnovy, chyby a nápravná opatření. Testovací data po drill bezpečně odstranit.

Restore drill provést před pilotem a následně alespoň čtvrtletně nebo po zásadní změně schématu.
