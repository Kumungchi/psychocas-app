# 📧 Custom SMTP Configuration for Psychočas

## 🎯 Proč vlastní SMTP?

✅ **Profesionální vzhled** - emaily z `info@psychocas.cz` místo Supabase  
✅ **Větší důvěryhodnost** - vlastní doména  
✅ **Vyšší limity** - Seznam.cz Profi má vyšší limity než Supabase default  
✅ **Lepší doručitelnost** - méně šance skončit ve spamu  

---

## 🔧 Nastavení Custom SMTP v Supabase

### Krok 1: Získej SMTP credentials

Z **Seznam.cz Profi** administrace pro `info@psychocas.cz`:

```
SMTP Server: smtp.seznam.cz
SMTP Port: 465 (SSL) nebo 587 (TLS)
SMTP Security: SSL/TLS
Username: info@psychocas.cz
Password: [heslo k emailovému účtu]
```

### Krok 2: Konfigurace v Supabase Dashboard

1. **Otevři:** https://supabase.com/dashboard/project/YOUR_PROJECT/settings/auth
2. **Scroll dolů na:** "SMTP Settings"
3. **Klikni:** "Set up custom SMTP server" (žluté tlačítko)
4. **Vyplň:**

```yaml
SMTP Host: smtp.seznam.cz
SMTP Port: 465
SMTP User: info@psychocas.cz
SMTP Password: [heslo]
SMTP Secure: true (SSL)
Sender Email: info@psychocas.cz
Sender Name: Psychočas
```

### Krok 3: Test Connection

Klikni na **"Test connection"** - mělo by vrátit ✅ Success.

---

## 📧 Email Template s upozorněním

### Subject (předmět emailu):

```
Váš přihlašovací kód do Psychočas - neodpovídejte
```

nebo

```
[Neodpovídejte] Váš přihlašovací kód do Psychočas
```

### Footer obsahuje:

```
⚠️ Neodpovídejte na tento email - zprávy nejsou sledovány.

Toto je automatická zpráva z aplikace Psychočas.
Pro podporu kontaktujte: podpora@psychocas.cz
```

---

## 🧪 Testování

### Test 1: Odeslat testovací email z Supabase

V Supabase Dashboard → Authentication → Email Templates:

1. Vyber "Magic Link" template
2. Klikni "Send test email"
3. Zadej testovací email
4. Zkontroluj inbox:
   - ✅ Odesílatel: Psychočas <info@psychocas.cz>
   - ✅ Předmět: "Váš přihlašovací kód do Psychočas - neodpovídejte"
   - ✅ Obsah: Krásný Psychočas design s 6-digit kódem

### Test 2: Reálná registrace

1. Otevři: https://psychocas-app-9kj4.vercel.app/login
2. Zadej email
3. Zkontroluj:
   - ✅ Email dorazil do 1 minuty
   - ✅ Neskončil ve spamu
   - ✅ Odesílatel je `info@psychocas.cz`

---

## ⚙️ Seznam.cz SMTP Nastavení

### Pro SSL (doporučeno):

```
Server: smtp.seznam.cz
Port: 465
Encryption: SSL
Authentication: Yes
Username: info@psychocas.cz
Password: [heslo]
```

### Pro TLS (alternativa):

```
Server: smtp.seznam.cz
Port: 587
Encryption: TLS/STARTTLS
Authentication: Yes
Username: info@psychocas.cz
Password: [heslo]
```

---

## 🚨 Rate Limits (Seznam.cz Profi)

Seznam.cz má limity pro odesílání emailů:

- **Hodinový limit:** cca 100 emailů/hodinu
- **Denní limit:** cca 1000 emailů/den

Pro velké kampaně (např. hromadné přidání členů) doporuč rozdělit odesílání:
- Použít batch processing (max 50 emailů najednou)
- Pauza 5 minut mezi batchi

---

## 🔐 Bezpečnost

### Doporučení:

1. **Nikdy necommituj heslo do Git** ❌
2. **Heslo ukládej pouze v Supabase Dashboard** ✅
3. **Použij silné heslo** pro `info@psychocas.cz` ✅
4. **Zapni 2FA** na Seznam.cz účtu (pokud je možné) ✅

### Nouzové kontakty:

Pokud někdo získá přístup k SMTP:
1. Změň heslo k `info@psychocas.cz` v Seznam.cz
2. Aktualizuj heslo v Supabase SMTP Settings
3. Zkontroluj odeslané emaily v Seznam.cz administraci

---

## 📊 Monitorování

### Kde sledovat odeslané emaily:

1. **Supabase Dashboard:**
   - Authentication → Logs
   - Filtr: "email sent"

2. **Seznam.cz Webmail:**
   - Přihlas se na `info@psychocas.cz`
   - Složka: "Odeslaná pošta"
   - Zkontroluj, že se tam ukládají OTP emaily

3. **Chybové hlášky:**
   - Supabase Logs → Error logs
   - Hledej: "SMTP error" nebo "Email failed"

---

## 🛠️ Troubleshooting

### Problém: "Authentication failed"

**Řešení:**
- Zkontroluj username (musí být celý email: `info@psychocas.cz`)
- Zkontroluj heslo (žádné mezery na začátku/konci)
- Zkontroluj, že účet není zablokovaný v Seznam.cz

### Problém: "Connection timeout"

**Řešení:**
- Zkus změnit port z 465 na 587
- Zkontroluj, že Supabase má přístup k `smtp.seznam.cz`
- Zkontroluj firewall na Seznam.cz straně

### Problém: "Emails go to spam"

**Řešení:**
- Zkontroluj SPF record pro `psychocas.cz`:
  ```
  v=spf1 include:_spf.seznam.cz ~all
  ```
- Přidej DKIM (pokud Seznam.cz podporuje)
- Testuj na různých email providrech (Gmail, Seznam, Outlook)

---

## ✅ Checklist pro nasazení

- [ ] Získat SMTP credentials od Seznam.cz
- [ ] Nastavit Custom SMTP v Supabase
- [ ] Otestovat "Send test email"
- [ ] Nahrát upravený email template (s "neodpovídejte")
- [ ] Změnit Subject na: "Váš přihlašovací kód - neodpovídejte"
- [ ] Otestovat reálnou registraci
- [ ] Zkontrolovat, že email neskončil ve spamu
- [ ] Nastavit monitoring v Supabase Logs

---

## 📞 Kontakty

**Email support:** podpora@psychocas.cz  
**SMTP technické dotazy:** Seznam.cz podpora  
**Supabase SMTP docs:** https://supabase.com/docs/guides/auth/auth-smtp

---

## 🎯 Výsledek

Po dokončení setup:

✅ Emaily odchází z `info@psychocas.cz`  
✅ Odesílatel: "Psychočas"  
✅ Předmět obsahuje "neodpovídejte"  
✅ Footer má červené upozornění  
✅ Design odpovídá Psychočas brand  
✅ Žádné Supabase branding  

**Profesionální, důvěryhodná komunikace s členy!** 🎉
