# ✅ FINÁLNÍ SETUP - Magic Link na localhost:3000

## 🎯 JEDINÝ PORT: localhost:3000

Ukončil jsem všechny další dev servery. Máme nyní POUZE:
- **http://localhost:3000** ✅

---

## 📋 Supabase Dashboard - FINÁLNÍ NASTAVENÍ

### Krok 1: Site URL
```
http://localhost:3000
```

### Krok 2: Redirect URLs
Přidejte POUZE tyto 2 URLs:
```
http://localhost:3000/auth/callback
https://psychocas-app-9kj4.vercel.app/auth/callback
```

**TO JE VŠE!** Žádné další porty!

---

## 🧪 Testování (Konečná verze)

### 1. Otevřete prohlížeč
```
http://localhost:3000/login
```

### 2. Zadejte email
```
bunnik.matias@seznam.cz
```

### 3. Klikněte "Odeslat přihlašovací odkaz"

### 4. Zkopírujte Magic Link z emailu

### 5. UPRAVTE redirect_to v URL
**Originální URL z emailu:**
```
https://wsgmbtcsyccnzfenfucl.supabase.co/auth/v1/verify?token=XXX&type=magiclink&redirect_to=https://psychocas-app-9kj4.vercel.app
```

**Změňte na:**
```
https://wsgmbtcsyccnzfenfucl.supabase.co/auth/v1/verify?token=XXX&type=magiclink&redirect_to=http://localhost:3000/auth/callback
```

### 6. Vložte do prohlížeče a sledujte

**Očekávaný flow:**
1. Loading screen: "Přihlašuji vás..." (české znaky!)
2. Success screen: "Úspěch!"
3. Redirect na: `http://localhost:3000/home`
4. Zobrazí se logo s hodinami a vaše data

---

## 🔧 Co bylo opraveno

1. ✅ **UTF-8 znaky** - Odstraněny inline style objekty, přidány CSS třídy
2. ✅ **JEDEN PORT** - Ukončeny všechny ostatní servery
3. ✅ **Debugging** - Console logy pro sledování auth procesu

---

## 🐛 Pokud stále nefunguje

### Zkontrolujte Console (F12):
Měli byste vidět:
```
=== Starting auth callback ===
Full URL: http://localhost:3000/auth/callback?token=...&type=magiclink
URL params: { token: '...', type: 'magiclink' }
Session created successfully!
```

### Zkontrolujte Cookies (F12 → Application → Cookies):
Měli byste vidět:
```
sb-wsgmbtcsyccnzfenfucl-auth-token
```

### Pokud vidíte redirect loop:
1. Vymažte všechny cookies pro localhost
2. Hard refresh (Ctrl + Shift + R)
3. Zkuste znovu

---

## 📊 Supabase Dashboard Checklist

- [ ] Site URL = `http://localhost:3000`
- [ ] Redirect URLs obsahují `http://localhost:3000/auth/callback`
- [ ] Email template má správnou šablonu (nebo výchozí)
- [ ] Confirm email je DISABLED (pro Magic Link)

---

**Dev Server**: http://localhost:3000 ✅  
**Status**: Připraveno k testu  
**Datum**: 9. října 2025
