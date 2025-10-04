# Supabase Database Setup

Tento dokument obsahuje instrukce pro nastavení databáze v Supabase projektu.

## 📋 Kroky pro nastavení

### 1. Připojení k Supabase
- URL: `https://wsgmbtcsyccnzfenfucl.supabase.co`
- Anon Key: Je nastavený v `.env.local`
- Service Role Key: Je nastavený v `.env.local`

### 2. Spuštění SQL skriptů
V Supabase Dashboard → SQL Editor postupně spusťte následující soubory:

1. **`sql/01_schema.sql`** - Vytvoří základní tabulky
2. **`sql/02_rls_policies.sql`** - Nastaví Row Level Security
3. **`sql/03_triggers.sql`** - Přidá anti-spam triggery
4. **`sql/04_views.sql`** - Vytvoří pohledy pro statistiky
5. **`sql/05_test_data.sql`** - Přidá testovací data

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
- `created_at` (timestamptz)

#### `tokens` - Žetony
- `id` (uuid, PK)
- `code` (text, unique)
- `user_id` (uuid, FK → members.user_id)
- `issued_at` (timestamptz)
- `expires_at` (timestamptz)
- `consumed_at` (timestamptz, nullable)

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
- Test data obsahují jednu pobočku pro testování

## 🔄 Aktualizace schématu

Při změnách databázového schématu:
1. Aktualizujte příslušné `.sql` soubory
2. Spusťte změny v Supabase SQL Editoru
3. Otestujte pomocí health check komponenty