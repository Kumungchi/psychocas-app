# 👥 Trusted Users & Member Approval System

## 📋 Přehled

Systém pro správu schválených uživatelů (trusted users) a proces schvalování nových členů.

---

## 🗄️ Databázové schéma

### Nová tabulka: `trusted_users`

```sql
trusted_users
├── id (uuid)
├── email (text, unique)
├── first_name (text) ✨ NOVÉ
├── last_name (text) ✨ NOVÉ
├── phone (text)
├── role (text: member/manager/council/technician)
├── added_by (uuid → members.user_id)
├── added_at (timestamptz)
└── notes (text)
```

### Rozšířená tabulka: `members`

```sql
members (přidané sloupce)
├── first_name (text) ✨ NOVÉ
├── last_name (text) ✨ NOVÉ
├── phone (text) ✨ NOVÉ
├── approved (boolean) ✨ NOVÉ
├── approved_at (timestamptz) ✨ NOVÉ
└── approved_by (uuid → members.user_id) ✨ NOVÉ
```

---

## 🔄 Životní cyklus člena

### 1️⃣ Registrace (OTP přihlášení)

Uživatel se přihlásí přes OTP email → Trigger `handle_new_user()` zkontroluje:

```
┌─────────────────────────────────────┐
│  Je email v trusted_users?          │
└─────────────┬───────────────────────┘
              │
         ┌────▼────┐
         │   ANO   │ → ✅ Auto-schváleno
         │         │    - Role z trusted_users
         │         │    - Jméno z trusted_users
         │         │    - Členství aktivní 1 rok
         └─────────┘
              │
         ┌────▼────┐
         │   NE    │ → Další kontroly:
         └────┬────┘
              │
         ┌────▼─────────────────────────┐
         │ Je @psychočas.cz?            │
         │   ANO → ✅ Manager role      │
         │   NE  → ⚠️ Čeká na schválení │
         └──────────────────────────────┘
```

### 2️⃣ Čekání na schválení

Pokud **není** v `trusted_users` a **není** `@psychočas.cz`:

- ✅ Uživatel se může přihlásit
- ❌ Ale **nemá aktivní členství** (`membership_active = false`)
- ⚠️ Vidí hlášku: "Váš účet čeká na schválení"
- 📧 Notifikace pro adminy (@psychočas.cz)

### 3️⃣ Schválení adminem

Admin (council nebo @psychočas.cz manager) schválí člena:

```sql
SELECT approve_member(
  '<user_id_of_member>',
  '<user_id_of_approver>'
);
```

Po schválení:
- ✅ `approved = true`
- ✅ `membership_active = true`
- ✅ `membership_expires = +1 rok`
- ✅ Email potvrzení členu

---

## 🛠️ Admin funkce

### Přidání trusted user (pre-approval)

```sql
INSERT INTO public.trusted_users (email, first_name, last_name, role)
VALUES ('jan.novak@example.com', 'Jan', 'Novák', 'member');
```

Když se tento uživatel poprvé přihlásí OTP:
- ✅ Automaticky schválen
- ✅ Jméno a role z trusted_users
- ✅ Členství aktivní okamžitě

### Schválení existującího člena

```sql
-- Manuálně (SQL)
SELECT approve_member(
  '00000000-0000-0000-0000-000000000001', -- user_id člena
  auth.uid() -- user_id approvera
);

-- Nebo přes Admin UI (implementujeme v dalším kroku)
```

---

## 🔐 Oprávnění

### Kdo může spravovat trusted_users?

1. **Council** (rada) - vše
2. **Manager s @psychočas.cz emailem** - vše
3. **Ostatní manažeři** - pouze čtení

### Kdo může schvalovat členy?

1. **Council** (rada) - všechny členy
2. **Manager s @psychočas.cz emailem** - všechny členy
3. **Ostatní role** - nemohou schvalovat

---

## 📝 Příklady použití

### Příklad 1: Hromadné přidání členů před začátkem semestru

```sql
INSERT INTO public.trusted_users (email, first_name, last_name, role, notes)
VALUES 
  ('jan.novak@vutbr.cz', 'Jan', 'Novák', 'member', 'Student FIT'),
  ('petra.svobodova@vutbr.cz', 'Petra', 'Svobodová', 'member', 'Student FSI'),
  ('manager@psychočas.cz', 'Správce', 'Systému', 'manager', 'Admin účet')
ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name;
```

### Příklad 2: Schválení člena, který se registroval sám

```sql
-- Najít neschválené členy
SELECT user_id, email, first_name, last_name, created_at
FROM public.members
WHERE approved = false
ORDER BY created_at DESC;

-- Schválit vybraného člena
SELECT approve_member(
  '<user_id_from_above>',
  auth.uid()
);
```

### Příklad 3: Import členů z CSV

```sql
-- Připravit CSV s formátem: email,first_name,last_name,role
COPY public.trusted_users (email, first_name, last_name, role)
FROM '/path/to/members.csv'
DELIMITER ','
CSV HEADER;
```

---

## 🎯 Admin UI (plánováno v Kroku 2)

Vytvoříme stránku `/admin` pro:

1. **Správa trusted users**
   - ✅ Přidat nového trusted user
   - ✅ Editovat existující
   - ✅ Smazat z trusted users
   - ✅ Import z CSV

2. **Schvalování členů**
   - ✅ Seznam čekajících členů
   - ✅ Schválit/Zamítnout
   - ✅ Hromadné schvalování

3. **Správa slevových kódů** (původní požadavek)
   - ✅ Přidat/odebrat slevové kódy
   - ✅ Přidat/odebrat partnerské podniky

---

## 🚀 Nasazení

### Krok 1: Spusť SQL script v Supabase

```sql
-- V Supabase SQL Editor spusť:
nextjs-app/sql/08_trusted_users.sql
```

### Krok 2: Ověř setup

```sql
-- Zkontroluj novou tabulku
SELECT * FROM public.trusted_users;

-- Zkontroluj rozšířené sloupce
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'members' 
AND column_name IN ('first_name', 'last_name', 'approved');
```

### Krok 3: Přidej první trusted users

```sql
INSERT INTO public.trusted_users (email, first_name, last_name, role)
VALUES ('admin@psychočas.cz', 'Admin', 'Psychočas', 'council');
```

---

## 🎨 UI Flow (pro budoucí implementaci)

### Pro neschváleného člena:

```
┌────────────────────────────────────┐
│  Váš účet čeká na schválení        │
│                                     │
│  ⏳ Budeme vás kontaktovat po      │
│     ověření vašeho členství.       │
│                                     │
│  📧 Dotazy: podpora@psychočas.cz   │
└────────────────────────────────────┘
```

### Pro admina (Admin panel):

```
┌─────────────────────────────────────┐
│  Čekající schválení (3)             │
├─────────────────────────────────────┤
│  Jan Novák                          │
│  jan.novak@vutbr.cz                 │
│  Registrován: 5. 10. 2025           │
│  [✅ Schválit] [❌ Zamítnout]       │
├─────────────────────────────────────┤
│  Petra Svobodová                    │
│  petra.svobodova@vutbr.cz           │
│  Registrován: 4. 10. 2025           │
│  [✅ Schválit] [❌ Zamítnout]       │
└─────────────────────────────────────┘
```

---

## ✅ Výhody tohoto systému

1. **Bezpečnost** - Pouze předschválení uživatelé mají okamžitý přístup
2. **Flexibilita** - Admini můžou přidat trusted users kdykoli
3. **Kontrola** - Neznámí uživatelé čekají na schválení
4. **Audit trail** - Kdo a kdy schválil člena
5. **Hromadné operace** - Import CSV před začátkem semestru

---

## 📞 Next Steps

Po nasazení tohoto SQL scriptu:

1. ✅ Otestovat registraci trusted user
2. ✅ Otestovat registraci unknown user (čeká na schválení)
3. ✅ Implementovat Admin UI pro správu členů
4. ✅ Přidat notifikace pro adminy (nový čekající člen)
5. ✅ Přidat email potvrzení po schválení
