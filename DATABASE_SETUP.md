# 🗄️ Database Setup Guide

Detailní návod pro nastavení Supabase databáze pro Psychočas app.

## 📊 Schema Overview

### Core Tables

- **branches** - Pobočky spolku (Praha, Brno, Ostrava...)
- **members** - Uživatelské profily s rolemi
- **trusted_users** - Předem schválené účty čekající na import do members
- **tokens** - Dočasné slevové kódy (3min expiry)
- **redemptions** - Anonymní tracking využití

### Security Model

- **Row Level Security** (RLS) na všech tabulkách
- **Role-based policies** pro přístup k datům
- **UUID primary keys** pro bezpečnost
- **Foreign key constraints** pro integritu

---

## 🚀 Quick Setup

### 1. Zkopírujte kompletní schéma

Otevřete `sql/complete_schema.sql` a spusťte v Supabase SQL Editor:

```sql
-- Kompletní schéma je v souboru sql/complete_schema.sql
-- Obsahuje:
-- - Tabulky s constraints
-- - RLS policies
-- - Triggery pro anti-spam
-- - Views pro statistiky
-- - Testovací data
```

### 2. Ověření

Po spuštění zkontrolujte v **Table Editor**:

- ✅ 4 hlavní tabulky vytvořeny
- ✅ RLS enabled (🔒 ikona)
- ✅ Policies aktivní
- ✅ Testovací data vložena

> 📋 **Další kroky:** Jakmile schéma běží, pokračujte kontrolním seznamem v [`OPERATIONS_CHECKLIST.md`](./OPERATIONS_CHECKLIST.md). Najdete tam podrobný postup pro přidávání trusted users, ověřování rolí (member, manager, council, technician) a rychlé smoke testy přihlášení.

---

## 📝 Detailed Schema

### Table: branches

```sql
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    city VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Organizační struktura poboček
**RLS**: Všichni uživatelé mohou číst

### Table: members

```sql
CREATE TABLE members (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100),
    role user_role NOT NULL DEFAULT 'member',
    branch_id UUID REFERENCES branches(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Uživatelské profily s role-based přístupem
**RLS**: Uživatel vidí pouze svůj profil (+ manažeři svoji pobočku)

### Table: trusted_users

```sql
CREATE TABLE trusted_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email CITEXT NOT NULL UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role user_role NOT NULL DEFAULT 'member',
    branch_id UUID REFERENCES branches(id),
    membership_active BOOLEAN DEFAULT TRUE,
    access_expires_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX trusted_users_email_lower_idx ON trusted_users (lower(email));
```

**Purpose**: Whitelist kontaktů, kteří se mohou přihlásit i bez záznamu v `members` (např. noví členové nebo rada).

**RLS**: Doporučeno povolit pouze servisnímu klíči (Edge Functions) a administrátorům. Běžní uživatelé tabulku nečtou.

### Table: tokens

```sql
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    member_id UUID NOT NULL REFERENCES members(id),
    expires_at TIMESTAMP NOT NULL,
    redeemed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Dočasné slevové kódy s 3min expirací
**RLS**: Uživatel vidí pouze své tokeny

### Table: redemptions

```sql
CREATE TABLE redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID NOT NULL REFERENCES tokens(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    redeemed_by UUID NOT NULL REFERENCES members(id),
    redeemed_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Anonymní tracking využití pro statistiky
**RLS**: Pouze manažeři své pobočky + council všechny

---

## 🔐 RLS Policies

### Members Table Policies

```sql
-- Uživatel vidí svůj profil
CREATE POLICY "Users can read own profile"
ON members FOR SELECT
USING (auth.uid() = id);

-- Manažeři vidí svou pobočku
CREATE POLICY "Managers can read branch members"
ON members FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM members m
        WHERE m.id = auth.uid()
        AND m.role IN ('manager', 'council', 'technician')
        AND (m.branch_id = branch_id OR m.role IN ('council', 'technician'))
    )
);
```

### Tokens Table Policies

```sql
-- Uživatel spravuje své tokeny
CREATE POLICY "Users manage own tokens"
ON tokens FOR ALL
USING (auth.uid() = member_id);

-- Manažeři vidí tokeny k validaci
CREATE POLICY "Managers can validate tokens"
ON tokens FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM members m
        WHERE m.id = auth.uid()
        AND m.role IN ('manager', 'council', 'technician')
    )
);
```

---

## 🔧 Triggers & Functions

### Anti-Spam Protection

```sql
-- Pouze 1 aktivní token per user
CREATE OR REPLACE FUNCTION prevent_token_spam()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM tokens
        WHERE member_id = NEW.member_id
        AND expires_at > NOW()
        AND redeemed_at IS NULL
    ) THEN
        RAISE EXCEPTION 'User already has active token';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_multiple_active_tokens
    BEFORE INSERT ON tokens
    FOR EACH ROW
    EXECUTE FUNCTION prevent_token_spam();
```

### Automatic Cleanup

```sql
-- Vymazání expirovaných tokenů (spouští se Edge Functions)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM tokens
    WHERE expires_at < NOW() - INTERVAL '1 hour';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

---

## ✅ Trusted User Login Flow

Frontend využívá hook [`useMemberContext`](nextjs-app/src/hooks/useMemberContext.ts), který po přihlášení hledá aktivního člena
podle `auth.users.id`. Pokud záznam v `members` neexistuje, automaticky provede fallback do `trusted_users` a porovná e-mail bez
ohledu na velikost písmen.

1. Přidejte uživatele do `trusted_users` alespoň s e-mailem a rolí. Volitelné sloupce:
   - `membership_active = false` pozastaví přístup,
   - `access_expires_at` stanoví datum vypršení dočasného povolení,
   - `branch_id` a `role` se použijí přímo v aplikaci.
2. Jakmile se uživatel přihlásí přes Supabase Auth (magic link), hook vrátí syntetický `MemberData` a uživatel se dostane do aplikace.
3. Po finálním schválení můžete záznam přesunout do `members` – fallback se vypne automaticky, protože primární tabulka má přednost.

> Poznámka: Fallback vybírá první záznam odpovídající e-mailu (`ilike`). Ujistěte se, že e-maily v tabulce jsou unikátní a že RLS dovolí výběr pro servisní klíč použitý ve webové aplikaci.

---

## 📈 Statistics Views

### Daily Stats

```sql
CREATE OR REPLACE VIEW daily_redemptions AS
SELECT
    DATE(r.redeemed_at) as date,
    b.name as branch_name,
    COUNT(*) as redemption_count
FROM redemptions r
JOIN branches b ON r.branch_id = b.id
GROUP BY DATE(r.redeemed_at), b.name, b.id
ORDER BY date DESC, branch_name;
```

### Monthly Overview

```sql
CREATE OR REPLACE VIEW monthly_stats AS
SELECT
    DATE_TRUNC('month', r.redeemed_at) as month,
    b.name as branch_name,
    COUNT(*) as total_redemptions,
    COUNT(DISTINCT t.member_id) as unique_users
FROM redemptions r
JOIN tokens t ON r.token_id = t.id
JOIN branches b ON r.branch_id = b.id
GROUP BY month, b.name, b.id
ORDER BY month DESC, branch_name;
```

---

## 🧪 Test Data

### Sample Branches

```sql
INSERT INTO branches (name, city) VALUES
('Praha - Filozofická fakulta', 'Praha'),
('Brno - MUNI', 'Brno'),
('Ostrava - OAFF', 'Ostrava');
```

### Sample Members

```sql
-- Po vytvoření uživatelů přes Supabase Auth
INSERT INTO members (id, email, name, role, branch_id) VALUES
('user-uuid-1', 'member@test.cz', 'Test Member', 'member', branch-uuid),
('user-uuid-2', 'manager@test.cz', 'Test Manager', 'manager', branch-uuid);
```

---

## 🔍 Testing Queries

### Verify RLS Works

```sql
-- Test as authenticated user
SELECT * FROM members WHERE id = auth.uid();
SELECT * FROM tokens WHERE member_id = auth.uid();

-- Test policy violations (should fail)
SELECT * FROM members; -- Pouze vlastní profil
SELECT * FROM redemptions; -- Pouze manažeři
```

### Performance Tests

```sql
-- Index usage
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM tokens WHERE member_id = 'uuid' AND expires_at > NOW();

-- Check constraints
SELECT conname, contype FROM pg_constraint WHERE conrelid = 'tokens'::regclass;
```

---

## 🆘 Troubleshooting

### Common Issues

**Problem**: "permission denied for table"
**Solution**: RLS policy chybí nebo nesprávná

**Problem**: "duplicate key value violates unique constraint"
**Solution**: Testujete s již existujícími daty

**Problem**: "function uuid_generate_v4() does not exist"
**Solution**: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`

### Useful Queries

```sql
-- Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables WHERE schemaname = 'public';

-- List all policies
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies WHERE schemaname = 'public';

-- Active connections
SELECT * FROM pg_stat_activity WHERE datname = current_database();
```

---

## ✅ Verification Checklist

Po dokončení setupu:

- [ ] Všechny 4 tabulky vytvořeny
- [ ] RLS enabled na všech tabulkách
- [ ] Policies vytvořeny a aktivní
- [ ] Triggers fungují (test anti-spam)
- [ ] Views dostupné pro statistics
- [ ] Testovací data vložena
- [ ] Edge Functions mají správné permissions

**Ready for production!** 🚀