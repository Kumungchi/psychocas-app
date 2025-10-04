# 🏁 Kompletní Setup Guide - Psychočas App

Tento dokument vás provede kompletním nastavením aplikace od databáze po Edge Functions.

## 📋 Checklist před začátkem

- [x] ✅ Supabase projekt vytvořen (`wsgmbtcsyccnzfenfucl.supabase.co`)
- [x] ✅ API klíče nakonfigurovány v `.env.local`
- [ ] ⏳ SQL schéma nasazeno
- [ ] ⏳ Edge Functions nasazeny
- [ ] ⏳ Test data vytvořena

## 🗄️ Krok 1: Nastavení databáze

### A. Spuštění SQL skriptů v Supabase Dashboard

Jděte do Supabase Dashboard → SQL Editor a spusťte následující skripty **v tomto pořadí**:

1. **`sql/01_schema.sql`** - Vytvoří základní tabulky
2. **`sql/02_rls_policies.sql`** - Nastaví Row Level Security
3. **`sql/03_triggers.sql`** - Přidá anti-spam triggery
4. **`sql/04_views.sql`** - Vytvoří pohledy pro statistiky
5. **`sql/05_test_data.sql`** - Přidá testovací pobočku

### B. Ověření databáze

Po spuštění SQL:
1. Navštivte `http://localhost:3000/test`
2. Měli byste vidět ✅ pro oba testy (Auth + Database)

## 🔧 Krok 2: Nasazení Edge Functions

### A. Instalace Supabase CLI

```bash
npm install -g supabase
```

### B. Přihlášení a propojení

```bash
supabase login
cd nextjs-app
supabase init
supabase link --project-ref wsgmbtcsyccnzfenfucl
```

### C. Nastavení proměnných prostředí

V Supabase Dashboard → Settings → Edge Functions → Environment Variables přidejte:

```
SUPABASE_URL=https://wsgmbtcsyccnzfenfucl.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZ21idGNzeWNjbnpmZW5mdWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MzAxNDcsImV4cCI6MjA3NTEwNjE0N30.0bXbVPURXkw_ywESX8Iqa0ii2wXQ1FKpSKyEFPWwARw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZ21idGNzeWNjbnpmZW5mdWNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTUzMDE0NywiZXhwIjoyMDc1MTA2MTQ3fQ.-RiOBHQoLs1l5fhHV9w-IQEt9pfWtYYZfDfKf5IZfTg
```

### D. Deploy funkcí

```bash
supabase functions deploy
```

## 👥 Krok 3: Vytvoření testovacích uživatelů

### A. Registrace uživatelů přes Supabase Auth UI

1. Jděte do Supabase Dashboard → Authentication → Settings → Auth → Email Auth
2. Povolit "Enable email confirmations" (false pro testing)
3. Vytvořit uživatele v Authentication → Users:
   - **Běžný člen**: `member@test.com` 
   - **Manažer**: `manager@test.com`

### B. Přidání členských údajů do databáze

Po registraci uživatelů spusťte v SQL Editoru:

```sql
-- Pro běžného člena
INSERT INTO public.members (user_id, email, full_name, branch_id, role, membership_active) 
VALUES (
  '[USER_UUID_FROM_AUTH]', 
  'member@test.com', 
  'Test Člen', 
  '550e8400-e29b-41d4-a716-446655440000', 
  'member', 
  true
);

-- Pro manažera
INSERT INTO public.members (user_id, email, full_name, branch_id, role, membership_active) 
VALUES (
  '[MANAGER_UUID_FROM_AUTH]', 
  'manager@test.com', 
  'Test Manažer', 
  '550e8400-e29b-41d4-a716-446655440000', 
  'manager', 
  true
);
```

**Poznámka**: Nahraďte `[USER_UUID_FROM_AUTH]` skutečným UUID z Supabase Auth.

## 🧪 Krok 4: Testování funkcí

### A. Získání access tokenů

1. Přihlaste se jako člen/manažer přes aplikaci
2. V browser dev tools (F12) → Application → Local Storage
3. Zkopírujte hodnotu `sb-wsgmbtcsyccnzfenfucl-auth-token`

### B. Test generate_token

```bash
curl -X POST \
  -H "Authorization: Bearer MEMBER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  https://wsgmbtcsyccnzfenfucl.supabase.co/functions/v1/generate_token
```

**Očekávaný výsledek**:
```json
{
  "code": "ABC4-XY89",
  "expiresAt": "2025-10-04T14:03:00.000Z"
}
```

### C. Test redeem_token

```bash
curl -X POST \
  -H "Authorization: Bearer MANAGER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"ABC4-XY89"}' \
  https://wsgmbtcsyccnzfenfucl.supabase.co/functions/v1/redeem_token
```

**Očekávaný výsledek**:
```json
{
  "valid": true
}
```

## ✅ Final Checklist

Po dokončení všech kroků ověřte:

- [ ] Health check na `/test` ukazuje ✅ pro Auth i Database
- [ ] generate_token vrací kód s expirací
- [ ] redeem_token úspěšně validuje kódy  
- [ ] Opakované použití kódu vrací `"valid": false`
- [ ] Expirované kódy jsou odmítnuty
- [ ] Neaktivní členové nemohou generovat kódy
- [ ] Pouze manažeři mohou validovat kódy

## 🚀 Spuštění aplikace

```bash
cd nextjs-app
npm run dev
```

Aplikace běží na `http://localhost:3000`

---

**🔄 Aktuální stav:** Database health check selhává, protože SQL skripty ještě nebyly spuštěny. Začněte krokem 1!