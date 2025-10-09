# Magic Link Autentizace - Návod k nastavení

Tento projekt používá **Magic Link autentizaci** přes Supabase. Uživatelé se přihlašují kliknutím na odkaz v emailu místo zadávání hesla nebo OTP kódu.

## ✨ Co je Magic Link?

Magic Link je bezpečná metoda přihlášení, kdy:
1. Uživatel zadá svůj email
2. Dostane email s jedinečným odkazem
3. Klikne na odkaz a je automaticky přihlášen
4. **Žádné heslo ani kódy!**

## 🔧 Nastavení v Supabase Dashboard

### 1. Přejděte do Supabase Dashboard

1. Otevřete [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Vyberte váš projekt **Psychočas**

### 2. Nastavte Email Provider

1. Jděte na **Authentication** → **Providers**
2. Najděte sekci **Email**
3. Ujistěte se, že je **Email Auth povolený** (Enable Email Provider)

### 3. Nakonfigurujte Email Templates

1. V Authentication menu klikněte na **Email Templates**
2. Vyberte šablonu **Magic Link**

#### Použijte tuto šablonu:

**Subject (Předmět emailu):**
```
Přihlášení do Psychočas aplikace
```

**Email Body (HTML):**
Zkopírujte obsah souboru `email-templates/magic-link.html` z tohoto projektu.

**Důležité proměnné v šabloně:**
- `{{ .ConfirmationURL }}` - automaticky vygenerovaný přihlašovací odkaz
- Tato proměnná je poskytována Supabase, neměňte ji!

### 4. Nastavte URL redirects

1. V Authentication menu jděte na **URL Configuration**
2. Přidejte tyto URL do **Redirect URLs**:

```
http://localhost:3000/home
https://vase-produkční-domena.cz/home
```

⚠️ **DŮLEŽITÉ:** Nahraďte `vase-produkční-domena.cz` vaší skutečnou doménou!

### 5. Nastavte Email Rate Limiting (volitelné)

1. V Authentication menu jděte na **Rate Limits**
2. Doporučené nastavení:
   - **Email send rate limit:** 4 emails za hodinu na email adresu
   - To zabrání zneužití systému

### 6. Nakonfigurujte SMTP (Produkční)

Pro produkční prostředí je **důrazně doporučeno** nastavit vlastní SMTP server místo Supabase výchozího.

1. Jděte na **Project Settings** → **Authentication**
2. Scrollujte dolů na **SMTP Settings**
3. Vyplňte údaje vašeho SMTP serveru:
   - **Sender email:** noreply@psychocas.cz
   - **Sender name:** Psychočas
   - **Host:** smtp.vasemail.cz
   - **Port:** 587 (nebo 465)
   - **Username:** váš SMTP username
   - **Password:** váš SMTP heslo

**Doporučené SMTP poskytovatele:**
- SendGrid
- Mailgun
- AWS SES
- Postmark

## 🎨 Přizpůsobení Email šablony

Šablona v `email-templates/magic-link.html` používá design systém Psychočas:

**Barvy:**
- Primární modrá: `#049edb`
- Tmavá modrá: `#1d4f7d`
- Gradient: `linear-gradient(135deg, #1d4f7d 0%, #049edb 100%)`

**Můžete upravit:**
- Text zpráv (v češtině)
- Styling tlačítek
- Logo (přidejte obrázek místo textu "Psychočas")

**NESMÍTE změnit:**
- `{{ .ConfirmationURL }}` - tato proměnná je nutná pro funkčnost

## 🔒 Bezpečnostní nastavení

### Vypršení odkazu
Ve výchozím nastavení platí Magic Link **60 minut** (3600 sekund).

Chcete-li změnit:
1. Jděte na **Authentication** → **Settings**
2. Najděte **Magic Link Expiry Duration**
3. Změňte hodnotu (v sekundách)

Doporučeno: **3600** (60 minut)

### Povolení nových uživatelů

V kódu je nastaveno `shouldCreateUser: true`, což znamená:
- ✅ Noví uživatelé mohou vytvořit účet přes Magic Link
- ✅ Existující uživatelé se mohou přihlásit

Pokud chcete povolit pouze existující uživatele:
- Změňte v `src/app/login/page.tsx`: `shouldCreateUser: false`

## 📋 Testování

### Testovací postup:

1. **Spusťte vývojový server:**
   ```bash
   npm run dev
   ```

2. **Otevřete login stránku:**
   ```
   http://localhost:3000/login
   ```

3. **Zadejte váš email a klikněte "Odeslat přihlašovací odkaz"**

4. **Zkontrolujte email:**
   - Měli byste obdržet email do 1-2 minut
   - Pokud ne, zkontrolujte spam
   - V development módu může Supabase používat "inbucket" pro testování

5. **Klikněte na odkaz v emailu**
   - Měli byste být automaticky přesměrováni na `/home`
   - Session by měla být aktivní

6. **Ověřte přihlášení:**
   - Zkontrolujte, že vidíte navigaci
   - Zkuste obnovit stránku - měli byste zůstat přihlášeni

## 🐛 Řešení problémů

### Email nedorazil?
1. Zkontrolujte spam/nevyžádanou poštu
2. Ověřte, že je email provider povolen v Supabase
3. Zkontrolujte rate limiting - možná jste dosáhli limitu
4. V development prostředí zkuste použít Supabase inbucket

### Odkaz nefunguje?
1. Zkontrolujte, že URL je v seznamu povolených Redirect URLs
2. Ověřte, že odkaz nevypršel (60 minut)
3. Zkontrolujte konzoli prohlížeče pro chyby

### Přesměrování nefunguje?
1. Ověřte `emailRedirectTo` v kódu odpovídá povolené URL
2. Zkontrolujte že middleware správně zpracovává routes
3. Podívejte se do Network tab v dev tools

## 📝 Poznámky k implementaci

**Co dělá kód:**

1. **Login komponenta** (`src/app/login/page.tsx`):
   - Zobrazuje formulář pro email
   - Volá `supabase.auth.signInWithOtp()` s emailem
   - Zobrazuje "email odeslán" obrazovku
   - Používá `emailRedirectTo` pro nastavení kam má Supabase přesměrovat

2. **Supabase automaticky:**
   - Generuje jedinečný token
   - Vytvoří URL s tokenem
   - Odešle email pomocí vaší šablony
   - Ověří token když uživatel klikne na odkaz
   - Vytvoří session pro uživatele
   - Přesměruje na vámi zvolenou URL

3. **Middleware** (`src/middleware.ts`):
   - Chrání routes jako `/home`, `/admin`, atd.
   - Kontroluje platnou session
   - Přesměruje nepřihlášené na `/login`

## ✅ Checklist pro produkci

Před nasazením do produkce zkontrolujte:

- [ ] SMTP server nakonfigurován
- [ ] Email šablona nahraná v Supabase
- [ ] Produkční URL přidána do Redirect URLs
- [ ] Rate limiting nastaven
- [ ] Sender email ověřen
- [ ] Testované na produkční doméně
- [ ] SSL certifikát aktivní
- [ ] Email doručitelnost otestována

## 🎯 Výhody Magic Link vs OTP

**Proč jsme přešli z OTP na Magic Link:**

✅ **Jednodušší pro uživatele**
- Jen kliknou na odkaz
- Žádné opisování kódů
- Funguje na všech zařízeních

✅ **Méně chyb**
- Žádné překlepy v kódu
- Žádné "vypršel kód" problémy
- Jasný user flow

✅ **Stejně bezpečné**
- Supabase vestavěná funkce
- Kryptograficky bezpečné tokeny
- Časově omezená platnost

✅ **Lepší UX**
- Mobilní friendly
- Intuitivní proces
- Profesionální vzhled

---

**Vytvořeno pro Psychočas aplikaci**
Verze: Magic Link Implementation v1.0
Datum: Říjen 2025
