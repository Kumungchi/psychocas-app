# Historický Supabase Database Setup Guide

> **Nepoužívat pro aktivní aplikaci.** Tento dokument je archiv původního Supabase řešení. Produkční runtime používá výhradně Convex; aktuální orientace, schéma a deployment jsou v [dokumentaci aplikace](nextjs-app/docs/README.md) a [Convex backend guide](nextjs-app/convex/README.md).

Detailní návod pro nastavení Supabase databáze pro Psychočas app po migraci na `memberships`.

## 📊 Schema Overview

### Core Tables

- **branches** – Pobočky spolku (Praha, Brno, …)
- **memberships** – Aktivní členové včetně role, pobočky a stavu členství
- **membership_whitelist** – Whitelist e-mailů čekající na první přihlášení
- **tokens** – Dočasné slevové kódy (3min expiry)
- **redemptions** – Anonymní tracking využití tokenů

### Security Model

- Všechny tabulky mají **Row Level Security**
- Politiky využívají role `member | manager | council | technician | admin`
- `ensure_membership_from_whitelist()` je RPC volané po přihlášení a napojeno na whitelist

---

## 🚀 Quick Setup

1. Otevřete `sql/complete_schema.sql` v Supabase SQL Editoru a spusťte celý soubor.
2. Zkontrolujte v Table Editoru:
   - ✅ Tabulky `branches`, `memberships`, `membership_whitelist`, `tokens`, `redemptions`
   - ✅ RLS je aktivní (ikonka 🔒)
   - ✅ Funkce `ensure_membership_from_whitelist` a view `membership_whitelist_status`
3. Případně spusťte `sql/05_test_data.sql` pro seed testovacích dat.

> 📋 **Další kroky:** Vložte testovací e-maily do `membership_whitelist` a následně se přihlaste přes Supabase Auth. Edge/Next.js klient zavolá `ensure_membership_from_whitelist()` a záznam v `memberships` se vytvoří automaticky.

---

## 📝 Detailed Schema

### Table: branches

```sql
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  city TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Table: memberships

```sql
CREATE TABLE memberships (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  phone TEXT,
  branch_id UUID REFERENCES branches(id),
  role TEXT NOT NULL CHECK (role IN ('member','manager','council','technician','admin')) DEFAULT 'member',
  membership_active BOOLEAN DEFAULT FALSE,
  membership_expires DATE,
  approved BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES memberships(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Table: membership_whitelist

```sql
CREATE TABLE membership_whitelist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('member','manager','council','technician','admin')) DEFAULT 'member',
  branch_id UUID REFERENCES branches(id),
  note TEXT,
  invited_by UUID REFERENCES memberships(user_id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  consumed_at TIMESTAMP WITH TIME ZONE,
  consumed_by UUID REFERENCES memberships(user_id),
  active BOOLEAN DEFAULT TRUE
);
```

### Table: tokens

```sql
CREATE TABLE tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES memberships(user_id),
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Table: redemptions

```sql
CREATE TABLE redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID REFERENCES tokens(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id),
  redeemed_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔐 Key RLS Policies

Ukázky politík jsou v `sql/02_rls_policies.sql`. Hlavní body:

- `member_read_self` – člen vidí/aktualizuje vlastní profil
- `technician_read_all_members` + `council_read_all_members` – plný přístup pro techniky, council a adminy
- `staff_manage_membership_whitelist` – whitelist spravují admini, technici a council (případně manažeři s @psychocas.cz)
- Tokeny a redemptions používají kombinaci branch match + role

---

## 🔧 Functions & Triggers

### ensure_membership_from_whitelist()

```sql
SELECT public.ensure_membership_from_whitelist();
```

- Volá se hned po přihlášení (Next.js guard + Edge funkce).
- Pokud existuje záznam v `membership_whitelist`, vytvoří/aktivuje členství a označí whitelist jako využitý.
- Pokud už členství existuje, pouze synchronizuje e-mail.

### set_memberships_updated_at trigger

Automaticky aktualizuje `updated_at` při změnách profilu.

### prevent_token_spam trigger

Zaručuje, že člen má pouze jeden aktivní token.

---

## 🧪 Testovací data

- `sql/05_test_data.sql` vloží pobočky, whitelist i základní partner nabídky.
- `sql/06_test_members.sql` a `sql/07_fix_auth.sql` pomáhají s QA backfillem.

---

## ✅ Checklist po nasazení

- [ ] `ensure_membership_from_whitelist` funguje pro whitelistovaný e-mail (záznam v `memberships` + whitelist označen jako využitý)
- [ ] Ne-whitelistovaný e-mail skončí na obrazovce „Člen nenalezen“
- [ ] Admin (role `admin`) vidí whitelist i membership přehledy
- [ ] Reload přihlášeného uživatele vrací session (`supabase.auth.getSession()` + listener)

