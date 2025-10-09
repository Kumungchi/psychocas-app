# 🚨 KRITICKÁ OPRAVA - Magic Link Redirect

## Problém

Magic Link URL chybí `/auth/callback` cesta:
```
❌ ŠPATNĚ: redirect_to=https://psychocas-app-9kj4.vercel.app
✅ SPRÁVNĚ: redirect_to=https://psychocas-app-9kj4.vercel.app/auth/callback
```

## Řešení

### 1. Supabase Dashboard - Site URL ⚠️

Přejděte na: **Supabase Dashboard → Authentication → URL Configuration**

**Site URL** nastavte na:
```
http://localhost:3001
```

Pro lokální vývoj! (Ne produkční URL)

### 2. Redirect URLs

Ve stejné sekci přidejte do **Redirect URLs**:
```
http://localhost:3001/auth/callback
http://localhost:3000/auth/callback
https://psychocas-app-9kj4.vercel.app/auth/callback
```

### 3. Testování

Po změně Site URL:
1. **Odhlaste se** z Vercel aplikace (pokud jste přihlášeni)
2. Otevřete **http://localhost:3001/login**
3. Zadejte email: `bunnik.matias@seznam.cz`
4. Klikněte "Odeslat Magic Link"
5. Nový Magic Link bude obsahovat správnou URL s `/auth/callback`

## Proč to nefungovalo

1. **Site URL** byl nastaven na produkční Vercel URL
2. Proto `window.location.origin` vracel Vercel URL místo localhost
3. `emailRedirectTo` byl správně nastaven na `${origin}/auth/callback`
4. ALE Supabase použil **Site URL** místo `emailRedirectTo`

## ⚡ Quick Fix

Supabase používá **Site URL** jako výchozí redirect URL, pokud není explicitně uvedeno jinak.

**Řešení**: Dočasně změňte Site URL na localhost během vývoje.

---

**Datum**: 9. října 2025  
**Status**: Čeká na opravu v Supabase Dashboard
