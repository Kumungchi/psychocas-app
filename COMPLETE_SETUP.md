# 📋 Kompletní Setup Guide - Psychočas App

Krok za krokem návod pro nasazení Psychočas členské aplikace.

## 🎯 Přehled nasazení

1. **GitHub Repository** ✅ (dokončeno)
2. **Supabase Backend** 🔄 (pokračujeme zde)
3. **Vercel Frontend** 🔄 (následuje)
4. **Testing & Production** 🔄 (finalizace)

---

## 🏗️ Krok 1: Supabase Backend Setup

### 1.1 Vytvoření projektu

1. Jděte na [supabase.com](https://supabase.com)
2. Klikněte **New Project**
3. Pojmenujte: `psychocas-app`
4. Vyberte organizaci a region (Prague/Frankfurt)
5. Vygeneruje se silné heslo - **uložte si ho!**

### 1.2 Database Schema

1. V Supabase Dashboard → **SQL Editor**
2. Zkopírujte obsah souboru `sql/complete_schema.sql`
3. Vložte do editoru a klikněte **RUN**
4. Ověřte vytvoření tabulek v **Table Editor**

### 1.3 Supabase Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link projekt (nahraďte PROJECT_REF)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy functions
supabase functions deploy
```

### 1.4 Environment Variables

Z Supabase Dashboard → **Settings** → **API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
```

⚠️ **Service Role Key** musí zůstat v tajnosti!

---

## 🚀 Krok 2: Vercel Frontend Deployment

### 2.1 Připojení GitHub

1. Jděte na [vercel.com](https://vercel.com)
2. Klikněte **New Project**
3. Importujte `Kumungchi/psychocas-app`
4. Root Directory: `nextjs-app`

### 2.2 Environment Variables

V Vercel → **Settings** → **Environment Variables**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
```

### 2.3 Deploy Settings

- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Node.js Version**: `18.x`

---

## 🔧 Krok 3: Configuration & Testing

### 3.1 Authentication Setup

V Supabase → **Authentication** → **Settings**:

1. **Site URL**: `https://your-app.vercel.app`
2. **Redirect URLs**: 
   - `https://your-app.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (development)

### 3.2 RLS Policies

Ověřte, že RLS policies fungují:

```sql
-- Test v SQL editoru
SELECT * FROM members WHERE id = auth.uid();
SELECT * FROM tokens WHERE member_id = auth.uid();
```

### 3.3 Test uživatelé

Vytvořte testovací účty:

1. **Member**: `member@example.com`
2. **Manager**: `manager@example.com`
3. **Council**: `council@example.com`

---

## 📊 Krok 4: Production Checklist

### 4.1 Security Review

- [ ] RLS povoleno na všech tabulkách
- [ ] Service Role Key není v kódu
- [ ] Redirect URLs správně nastavené
- [ ] Edge Functions deployed

### 4.2 Performance

- [ ] Obrázky optimalizované (faviconV1/V2)
- [ ] PWA manifest funkční
- [ ] Mobile responsivita testovaná

### 4.3 Monitoring

- [ ] Supabase Logs monitoring
- [ ] Vercel Analytics zapnuté
- [ ] Error tracking (Sentry optional)

---

## 🎯 Krok 5: Go Live!

### 5.1 Final Tests

```bash
# Health check endpoint
curl https://your-app.vercel.app/test

# Authentication flow
# 1. Přihlášení → magic link
# 2. Member → QR kód generování
# 3. Manager → validace kódu
```

### 5.2 User Onboarding

1. Sdílení URL: `https://your-app.vercel.app`
2. Instrukce pro členy Psychočasu
3. Vytvoření manažerských účtů po pobočkách

---

## 🆘 Troubleshooting

### Common Issues

**Problem**: "Invalid JWT token"
**Solution**: Zkontrolujte ANON_KEY v environment variables

**Problem**: "RLS policy violation"
**Solution**: Ověřte, že uživatel má správnou roli v tabulce `members`

**Problem**: Edge Functions nedostupné
**Solution**: `supabase functions deploy --project-ref YOUR_REF`

### Support

- **GitHub Issues**: [psychocas-app/issues](https://github.com/Kumungchi/psychocas-app/issues)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)

---

## 🎊 Success!

Vaše Psychočas aplikace je nyní live a připravena pro produkční použití!

**Next Steps:**
- Monitorování využití
- Uživatelská zpětná vazba  
- Feature updates podle potřeb spolku