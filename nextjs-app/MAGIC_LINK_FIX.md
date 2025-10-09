# 🔧 OPRAVA: Magic Link Callback Flow

## ✅ Co bylo opraveno:

### Problém:
- Magic Link přesměrovával zpět na login → **login loop** ❌
- Uživatel nebyl správně autentizován po kliknutí

### Řešení:
1. ✅ Vytvořena **callback route** (`/auth/callback/route.ts`)
2. ✅ Aktualizován **login page** - redirect na `/auth/callback`
3. ✅ Aktualizován **middleware** - skip kontroly pro callback route

---

## 📝 CO MUSÍTE UDĚLAT V SUPABASE:

### Přidejte nové Redirect URLs:

Jděte do: **Authentication** → **URL Configuration** → **Redirect URLs**

**Přidejte tyto URL:**

```
http://localhost:3000/auth/callback
https://psychocas-app-9kj4.vercel.app/auth/callback
```

⚠️ **DŮLEŽITÉ:** Tyto URL musí být přidány, jinak Magic Link nebude fungovat!

---

## 🔄 Jak to teď funguje:

```
1. Uživatel zadá email na /login
2. Supabase pošle Magic Link email
3. Uživatel klikne na odkaz
4. → Přesměrován na /auth/callback?code=xxx
5. → Callback route vyměnní code za session
6. → Přesměrován na /home
7. ✅ Uživatel je přihlášen!
```

**Žádný loop, čistý flow!** ✨

---

## 🧪 Jak otestovat:

1. **Restartujte dev server** (už běží)
2. **Přidejte callback URLs v Supabase** (viz výše)
3. Otevřete: http://localhost:3000/login
4. Zadejte email
5. Klikněte na odkaz v emailu
6. **Měli byste být přesměrováni na /home** ✅

---

## 📂 Změněné soubory:

### 1. NOVÝ: `/src/app/auth/callback/route.ts`
- Route handler pro Magic Link callback
- Vyměňuje authorization code za session
- Přesměrovává na /home

### 2. UPRAVENO: `/src/app/login/page.tsx`
- `emailRedirectTo` změněno z `/home` na `/auth/callback`

### 3. UPRAVENO: `/src/middleware.ts`
- Přidána výjimka pro `/auth/callback` route
- Middleware ji neblokuje

---

## 🎯 Důležité poznámky:

### Proč callback route?
Supabase Magic Link používá **PKCE flow**:
- Generuje `code` parameter
- Ten musí být vyměněn za session
- To dělá callback route

### Proč to nefungovalo předtím?
- Chybějící callback handler
- Magic Link posílal code, ale nebylo kam ho zpracovat
- Middleware blokoval přístup

### Co dělá callback route?
1. Přijme `?code=xxx` parameter
2. Volá `exchangeCodeForSession(code)`
3. Nastaví session cookies
4. Přesměruje na `/home`

---

## ✅ Checklist:

- [x] Callback route vytvořena
- [x] Login page aktualizován
- [x] Middleware aktualizován
- [ ] **Callback URLs přidány v Supabase** ← UDĚLEJTE TOTO!
- [ ] Otestováno

---

**Po přidání callback URLs v Supabase zkuste znovu!** 🚀
