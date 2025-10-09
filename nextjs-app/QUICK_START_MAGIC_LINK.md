# 🚀 RYCHLÝ NÁVOD - Magic Link nastavení

## Co jsem změnil v kódu:

✅ **Login stránka** - přepracována z OTP na Magic Link
✅ **Email template** - nová šablona pro Magic Link
✅ **Kompletní dokumentace** - viz MAGIC_LINK_SETUP.md

---

## ⚡ CO MUSÍTE UDĚLAT V SUPABASE (5 minut):

### 1️⃣ Nastavte Email Template

1. Otevřete **Supabase Dashboard**: https://supabase.com/dashboard
2. Vyberte váš Psychočas projekt
3. Jděte na: **Authentication** → **Email Templates**
4. Vyberte šablonu: **Magic Link**
5. **Zkopírujte obsah souboru:** `nextjs-app/email-templates/magic-link.html`
6. **Vložte do pole "Body"** v Supabase
7. **Subject (Předmět):** `Přihlášení do Psychočas aplikace`
8. Klikněte **Save**

### 2️⃣ Přidejte Redirect URLs

1. V Authentication menu jděte na: **URL Configuration**
2. Najděte sekci **Redirect URLs**
3. Přidejte tyto URL:

```
http://localhost:3000/home
```

(Když budete nasazovat do produkce, přidejte i produkční URL)

4. Klikněte **Save**

### 3️⃣ Ověřte že Email Provider je povolen

1. Jděte na: **Authentication** → **Providers**
2. Najděte **Email**
3. Ujistěte se, že je **zapnutý** (toggle switch vpravo)

---

## ✅ HOTOVO! Teď to otestujte:

1. **Spusťte app:**
   ```bash
   npm run dev
   ```

2. **Otevřete:** http://localhost:3000/login

3. **Zadejte email a klikněte "Odeslat přihlašovací odkaz"**

4. **Zkontrolujte email** (může trvat 1-2 minuty)

5. **Klikněte na odkaz** → měli byste být přesměrováni na /home

---

## 🎯 Jak to funguje:

```
Uživatel → Zadá email → Supabase odešle email s odkazem 
       → Uživatel klikne → Automaticky přihlášen → /home
```

**Žádné kódy, žádné hesla, jen kliknutí!** ✨

---

## 📧 Development vs Produkce:

### Development (teď):
- Supabase používá výchozí SMTP
- Emaily se odesílají z Supabase adresy
- Může jít do spamu
- **Stačí pro testování!**

### Produkce (později):
- Nastavte vlastní SMTP (SendGrid, Mailgun, atc.)
- Emaily z vaší domény (noreply@psychocas.cz)
- Lepší doručitelnost
- Více v MAGIC_LINK_SETUP.md

---

## 🆘 Problémy?

**Email nepřišel?**
- Zkontrolujte spam
- Zkuste jiný email
- V dev módu může Supabase používat testovací inbox

**Odkaz nefunguje?**
- Zkontrolujte že jste přidali redirect URL v kroku 2️⃣
- Zkuste restartovat dev server

**Další pomoc:**
- Kompletní návod: `MAGIC_LINK_SETUP.md`
- Supabase docs: https://supabase.com/docs/guides/auth/auth-magic-link

---

**Implementováno flawlessly! 🎉**
