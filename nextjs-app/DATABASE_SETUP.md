# Supabase Database Setup

Tento dokument obsahuje instrukce pro nastavení databáze v Supabase projektu.

## 📋 Kroky pro nastavení

### 1. Připojení k Supabase
- URL: `https://wsgmbtcsyccnzfenfucl.supabase.co`
- Anon Key: Je nastavený v `.env.local`
- Service Role Key: Je nastavený v `.env.local`

### 2. Spuštění SQL skriptů
Nejrychlejší cesta je použít připravený skript:

```bash
SUPABASE_DB_URL="postgresql://..." npm run deploy:schema
```

Příkaz spustí sekvenci souborů `01_schema.sql`, `02_rls_policies.sql`,
`03_triggers.sql`, `04_views.sql`, `08_trusted_users.sql` a `05_test_data.sql`.

> Alternativně lze stejné skripty spustit ručně v Supabase Dashboard → SQL
> Editoru ve výše uvedeném pořadí.

### 3. Testování
Po spuštění SQL skriptů:
1. Spusťte aplikaci: `npm run dev`
2. Navštivte: `http://localhost:3000/test`
3. Zkontrolujte zdraví systému

## 🗄️ Databázové schéma

### Tabulky

#### `branches` - Pobočky
- `id` (uuid, PK)
- `name` (text) - Název pobočky
- `city` (text) - Město
- `created_at` (timestamptz)

#### `members` - Členové
- `user_id` (uuid, PK, FK → auth.users)
- `email` (text, unique)
- `full_name` (text)
- `branch_id` (uuid, FK → branches.id)
- `role` (enum: member, manager, council, technician)
- `membership_active` (boolean)
- `membership_expires` (date)
- `approved` (boolean)
- `approved_at` (timestamptz)
- `first_name`, `last_name`, `phone` (text)
- `created_at` (timestamptz)

#### `tokens` - Žetony
- `id` (uuid, PK)
- `code` (text, unique)
- `user_id` (uuid, FK → members.user_id)
- `issued_at` (timestamptz)
- `expires_at` (timestamptz)
- `consumed_at` (timestamptz, nullable)

#### `trusted_users` - Předem schválení členové
- `id` (uuid, PK)
- `email` (text, unique)
- `first_name`, `last_name`, `phone`
- `role` (enum: member, manager, council, technician)
- `branch_id` (uuid, FK → branches.id)
- `added_by` (uuid, FK → members.user_id)
- `added_at` (timestamptz)
- `notes` (text)

#### `redemptions` - Uplatnění
- `id` (uuid, PK)
- `token_id` (uuid, FK → tokens.id)
- `branch_id` (uuid, FK → branches.id)
- `redeemed_at` (timestamptz)

### Pohledy

#### `redemptions_daily` - Denní statistiky
```sql
SELECT branch_id, day, total 
FROM public.redemptions_daily;
```

## 🔒 Row Level Security (RLS)

### Pravidla přístupu:
- **Členové**: Vidí své vlastní údaje a žetony
- **Manažeři**: Vidí členy a žetony své pobočky
- **Rada**: Vidí všechna uplatnění
- **Technici**: Vidí všechny členy

### Anti-spam ochrana:
- Jeden aktivní žeton na uživatele současně
- Trigger `prevent_token_spam()` kontroluje duplicity

## 🧪 Health Check

Aplikace obsahuje automatický health check na `/test`, který testuje:
1. **Auth připojení** - `supabase.auth.getUser()`
2. **Databázové dotazy** - `SELECT * FROM branches`
3. **RLS políčka** - Ověří, že pravidla fungují

## ⚠️ Důležité poznámky

- Všechny tabulky mají povolené RLS
- Redemptions lze vkládat pouze přes server-side funkce
- UUID extension musí být povoleno
- Test data zakládají dvě pobočky (Praha, Brno), národní i lokální partnery a
  trusted users odpovídající rolím MVP

## 🔄 Aktualizace schématu

Při změnách databázového schématu:
1. Aktualizujte příslušné `.sql` soubory
2. Spusťte změny v Supabase SQL Editoru
3. Otestujte pomocí health check komponenty
