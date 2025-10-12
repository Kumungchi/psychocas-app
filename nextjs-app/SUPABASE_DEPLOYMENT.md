# Supabase Deployment & QA Checklist

Tento průvodce shrnuje praktické kroky, jak lokálně i v produkci zprovoznit
celé backendové zázemí Psychočas aplikace – databázové skripty, Edge Functions
a testovací účty. Na konci najdete i rychlou kontrolu PWA funkčnosti.

## 1. Předpoklady
- nainstalovaný [Supabase CLI](https://supabase.com/docs/guides/cli)
- dostupné proměnné prostředí
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_DB_URL` (Postgres connection string s oprávněním service role)
  - `SUPABASE_PROJECT_REF` (pro `supabase functions deploy`)
- Node.js ≥ 18 a nainstalované závislosti (`npm install` v adresáři `nextjs-app`)

## 2. Nasazení databázového schématu
```bash
cd nextjs-app
SUPABASE_DB_URL="postgresql://..." npm run deploy:schema
```
Skript `scripts/applyDatabaseSchema.ts` postupně spustí SQL soubory
`01_schema.sql`, `02_rls_policies.sql`, `03_triggers.sql`, `04_views.sql`,
`08_trusted_users.sql` a `05_test_data.sql`, takže výsledná databáze obsahuje
větve, partnery, trusted users i testovací data pro rychlé ověření.

> 💡 Pokud pracujete přímo v Supabase Dashboardu, lze stejné soubory spustit
> ručně v SQL editoru ve stejném pořadí.

## 3. Seed testovacích účtů
```bash
NEXT_PUBLIC_SUPABASE_URL="https://..." \
SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
npm run seed:supabase
```
Skript vytvoří/aktualizuje větve, trusted users a přes Admin API založí
ověřené uživatele:
- `member.tester@psychocas.test` – běžný člen (Praha)
- `manager@psychocas.cz` – manažer pražské pobočky
- `tajemnik@psychocas.cz`, `viceprezident@psychocas.cz`, `prezident@psychocas.cz` – rada (council)
- `technik@psychocas.cz` – technická role

Všem účtům nastaví aktivní členství a datum expirace za 12 měsíců, takže lze
hned testovat tokeny, partner nabídky a přístupy podle rolí.

## 4. Nasazení Edge Functions
```bash
SUPABASE_PROJECT_REF="wsgm..." npm run deploy:functions
```
Příkaz deployne současně funkce `generate_token` a `redeem_token` z adresáře
`supabase/functions`. Po nasazení doporučujeme ověřit curl requesty popsané v
souboru [`EDGE_FUNCTIONS_SETUP.md`](EDGE_FUNCTIONS_SETUP.md).

## 5. Rychlá kontrola PWA funkčnosti
1. Spusťte build a production server: `npm run build && npm run start`
2. V Chromu otevřete aplikaci a přes DevTools → *Application* → *Manifest*
   ověřte, že je dostupné tlačítko *Install*.
3. Po instalaci (nebo kliknutí na „Stáhnout aplikaci“ kartě na domácí obrazovce)
   přepněte zařízení do offline režimu a znovu aplikaci otevřete.
4. Očekávané chování:
   - zobrazení poslední uložené členké karty a partnerů
   - offline banner s časem poslední synchronizace
   - tlačítko „Zkusit znovu“ blokuje generování tokenu, dokud se neobnoví síť

> Pokud se service worker neaktualizuje, vymažte cache (*Application* →
> *Service Workers* → *Unregister*) a znovu načtěte stránku online.

## 6. Po nasazení
- Zkontrolujte stránku `/test`, že všechny kontroly jsou zelené.
- Přihlaste se za člena, manažera i člena rady a ověřte přístup k partnerským
  nabídkám a administraci.
- V Supabase logách zkontrolujte, že Edge Functions přijímají požadavky bez
  chyb.

Tímto je backendová část MVP kompletně připravená na manuální i automatizované
ověření.
