# Next.js + Tailwind CSS + Supabase Starter

Moderní full-stack aplikace postavená na Next.js 15 s Tailwind CSS pro styling a Supabase pro backend služby.

## 🚀 Funkce

- ✅ **Next.js 15** s App Router
- ✅ **Tailwind CSS** pro styling
- ✅ **Supabase** pro autentifikaci a databázi
- ✅ **TypeScript** pro type safety
- ✅ **ESLint** pro kvalitu kódu
- ✅ **Middleware** pro chráněné routy

## 📦 Instalace

1. **Nastavte Supabase projekt**
   - Jděte na [supabase.com](https://supabase.com)
   - Vytvořte nový projekt
   - Zkopírujte Project URL a anon key z Settings > API

2. **Nastavte environment proměnné**
   Aktualizujte `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Spusťte vývojový server**
   ```bash
   npm run dev
   ```

4. **Otevřete aplikaci**
   Navigujte na [http://localhost:3000](http://localhost:3000)

## 🗄️ Databázový setup

V Supabase SQL editoru spusťte:

```sql
-- Příklad tabulky pro uživatelské profily
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  website text,
  constraint username_length check (char_length(username) >= 3)
);

-- Nastavit Row Level Security (RLS)
alter table profiles enable row level security;

create policy "Profily jsou veřejně viditelné." on profiles
  for select using (true);

create policy "Uživatelé si mohou aktualizovat vlastní profil." on profiles
  for update using (auth.uid() = id);
```

## 🎯 Použití

### Autentifikace

```tsx
import { supabase } from '@/lib/supabase'

// Registrace
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password'
})

// Přihlášení
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})
```

## 📁 Struktura projektu

```
src/
├── app/                 # Next.js App Router
├── components/         # React komponenty
├── lib/               # Utility funkce
└── middleware.ts      # Next.js middleware
```

## 🚀 Deployment

Nejjednodušší způsob deployment je pomocí [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Více informací v [Next.js deployment dokumentaci](https://nextjs.org/docs/app/building-your-application/deploying).
