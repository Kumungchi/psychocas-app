# 🗄️ Database Setup Guide

Detailní návod pro nastavení Supabase databáze pro Psychočas app.

## 📊 Schema Overview

### Core Tables

- **branches** - Pobočky spolku (Praha, Brno, Ostrava...)
- **profiles** - Veřejné profily napojené 1:1 na `auth.users`
- **memberships** - Aktivní členství s rolí, stavem a vazbou na pobočku
- **invites** - Předem schválené e-maily s dočasným přístupem
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

> 📋 **Další kroky:** Jakmile schéma běží, ověřte přihlášení pro role member/manager/council/technician a přidejte předem schválené účty do tabulky `invites`, aby se mohli přihlásit i bez hotového profilu v `memberships`.

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

### Table: profiles

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email CITEXT NOT NULL UNIQUE,
    full_name TEXT,
    phone TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Veřejná metadata uživatele nezávislá na členství.

### Table: memberships

```sql
CREATE TYPE membership_status AS ENUM ('pending', 'active', 'suspended', 'revoked');

CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    role user_role NOT NULL DEFAULT 'member',
    status membership_status NOT NULL DEFAULT 'pending',
    membership_active BOOLEAN NOT NULL DEFAULT FALSE,
    membership_expires DATE,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id)
);
```

**Purpose**: Reálné členství a role v Psychočas s možností schválení.

### Table: invites

```sql
CREATE TYPE invite_status AS ENUM ('pending', 'active', 'revoked', 'expired');

CREATE TABLE invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email CITEXT NOT NULL UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role user_role NOT NULL DEFAULT 'member',
    branch_id UUID REFERENCES branches(id),
    status invite_status NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    invited_by UUID REFERENCES auth.users(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX invites_email_lower_idx ON invites (lower(email));
```

**Purpose**: Whitelist kontaktů, kteří se mohou přihlásit i bez hotového členství (např. noví členové nebo rada).

**RLS**: Přístup jen pro manažery s @psychocas.cz, techniky a členy rady.

### Table: tokens

```sql
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    membership_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE
);
```

**Purpose**: Dočasné kódy pro ověření členství (např. QR redeem). `user_id` míří na veřejný profil, `membership_id` je doplňková vazba na aktuální členství.

### Table: redemptions

```sql
CREATE TABLE redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID REFERENCES tokens(id) ON DELETE SET NULL,
    membership_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id),
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Purpose**: Statistické logy uplatnění tokenů. Vazba na `membership_id` umožňuje analyzovat role/branch i po anonymizaci tokenu.

---

## 🔐 RLS Policies

Nový model využívá kombinaci `profiles` (1:1 s `auth.users`) a `memberships` (stav, role, pobočka). Níže jsou hlavní ukázky politik – plné znění najdete v `sql/02_rls_policies.sql`.

### Profiles & Memberships

```sql
-- Člen uvidí vlastní profil i členství
CREATE POLICY "profiles_read_self" ON profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "memberships_read_self" ON memberships
FOR SELECT USING (auth.uid() = user_id);

-- Technici mají národní přehled
CREATE POLICY "technician_read_all_memberships" ON memberships
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships me
    WHERE me.user_id = auth.uid()
      AND me.role = 'technician'
  )
);

-- Manažeři vidí členy své pobočky, council všechno
CREATE POLICY "manager_read_branch_memberships" ON memberships
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships me
    WHERE me.user_id = auth.uid()
      AND me.role = 'manager'
      AND me.branch_id = memberships.branch_id
  )
);

CREATE POLICY "council_manage_memberships" ON memberships
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM memberships me
    WHERE me.user_id = auth.uid()
      AND me.role IN ('council','technician')
  )
) WITH CHECK (...);
```

### Invites

```sql
CREATE POLICY "staff_manage_invites" ON invites
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM memberships me
    WHERE me.user_id = auth.uid()
      AND me.role IN ('manager','council','technician')
  )
) WITH CHECK (...);
```

### Tokens & Redemptions

```sql
-- člen spravuje vlastní tokeny
CREATE POLICY "member_read_own_tokens" ON tokens
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "manager_read_branch_tokens" ON tokens
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships me
    JOIN memberships owner ON owner.id = tokens.membership_id
    WHERE me.user_id = auth.uid()
      AND me.role = 'manager'
      AND me.branch_id = owner.branch_id
  )
);

-- Redeem logy – manažer pobočky / council národně
CREATE POLICY "manager_read_branch_redemptions" ON redemptions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships me
    WHERE me.user_id = auth.uid()
      AND me.role = 'manager'
      AND me.branch_id = redemptions.branch_id
  )
);

CREATE POLICY "council_read_all_redemptions" ON redemptions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships me
    WHERE me.user_id = auth.uid()
      AND me.role IN ('council','technician')
  )
);
```

### Partner Offers

```sql
CREATE POLICY "members_read_partner_offers" ON partner_offers
FOR SELECT USING (
  partner_offers.active = TRUE
  AND (
    partner_offers.scope = 'national'
    OR EXISTS (
      SELECT 1 FROM memberships me
      WHERE me.user_id = auth.uid()
        AND (
          me.role IN ('manager','council','technician')
          OR me.branch_id = partner_offers.branch_id
        )
    )
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
        WHERE user_id = NEW.user_id
          AND consumed_at IS NULL
          AND expires_at > NOW()
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
podle `auth.users.id`. Pokud záznam v `memberships` neexistuje, automaticky provede fallback do `invites` a porovná e-mail bez
ohledu na velikost písmen.

1. Přidejte uživatele do `invites` alespoň s e-mailem a rolí. Volitelné sloupce:
   - `status = 'active'` uvolní přístup okamžitě (jinak `pending`),
   - `expires_at` stanoví datum vypršení dočasného povolení,
   - `branch_id` a `role` se použijí přímo v aplikaci.
2. Jakmile se uživatel přihlásí přes Supabase Auth (magic link), hook vrátí syntetický `MemberData` a uživatel se dostane do aplikace.
3. Po finálním schválení aktivujte řádek v `memberships` (`status = 'active'`, `membership_active = true`) – fallback se vypne automaticky, protože primární tabulka má přednost.

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
    COUNT(DISTINCT t.membership_id) as unique_memberships
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

### Sample Memberships

```sql
-- Po vytvoření uživatelů přes Supabase Auth
INSERT INTO profiles (id, email, full_name) VALUES
('user-uuid-1', 'member@test.cz', 'Test Member'),
('user-uuid-2', 'manager@test.cz', 'Test Manager')
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (user_id, role, branch_id, status, membership_active)
VALUES
('user-uuid-1', 'member', 'your-branch-uuid'::uuid, 'active', TRUE),
('user-uuid-2', 'manager', 'your-branch-uuid'::uuid, 'active', TRUE)
ON CONFLICT (user_id) DO UPDATE SET
  role = EXCLUDED.role,
  branch_id = EXCLUDED.branch_id,
  status = EXCLUDED.status,
  membership_active = EXCLUDED.membership_active,
  approved_at = NOW();
```

---

## 🔍 Testing Queries

### Verify RLS Works

```sql
-- Test as authenticated user
SELECT * FROM memberships WHERE user_id = auth.uid();
SELECT * FROM tokens WHERE user_id = auth.uid();

-- Test policy violations (should fail)
SELECT * FROM memberships; -- Pouze vlastní členství + oprávněné role
SELECT * FROM redemptions; -- Pouze manažeři/council/technici
```

### Performance Tests

```sql
-- Index usage
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM tokens WHERE user_id = 'uuid' AND expires_at > NOW();

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