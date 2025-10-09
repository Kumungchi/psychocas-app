# 🧪 Testovací postup - Magic Link Authentication

## 📋 Testovací scénáře

### ✅ Test 1: Běžný uživatel (member)
**Email**: `bunnik.matias@seznam.cz`  
**Očekávaná role**: `member`  
**Přístup k**: `/home`, `/redeem`

#### Postup:
1. Otevřete http://localhost:3001
2. Zadejte email: `bunnik.matias@seznam.cz`
3. Klikněte na "Odeslat Magic Link"
4. Zkontrolujte Supabase Dashboard → Authentication → Users pro Magic Link
5. Nebo použijte email v inboxu (pokud je SMTP nakonfigurováno)
6. Klikněte na Magic Link
7. **Očekávaný výsledek**: 
   - Přesměrování na `/home`
   - Zobrazí se logo s hodinami
   - Vidíte "Vítejte zpět!" a své jméno
   - Stav členství zobrazený
   - Navigation menu: Domů, Odhlásit

---

### ✅ Test 2: Admin s @psychocas.cz emailem
**Email**: `viceprezident@psychocas.cz` nebo `admin@psychocas.cz`  
**Očekávaná role**: `council` nebo `manager`  
**Přístup k**: `/home`, `/validate`, `/stats`, `/admin`, `/technician`

#### Postup:
1. Otevřete http://localhost:3001
2. Zadejte email: `viceprezident@psychocas.cz`
3. Klikněte na "Odeslat Magic Link"
4. Zkontrolujte Supabase Dashboard → Authentication → Users pro Magic Link
5. Klikněte na Magic Link
6. **Očekávaný výsledek**: 
   - Přesměrování na `/home`
   - Zobrazí se logo s hodinami
   - Vidíte "Vítejte zpět!" a své jméno
   - Navigation menu: Domů, Ověření, Statistiky, Správa, Odhlásit
7. Zkuste navigovat na `/admin`
8. **Očekávaný výsledek**: 
   - Přístup povolen
   - Vidíte admin panel se záložkami

---

## 🔍 Co kontrolovat

### 1. **Logo zobrazení** ✅
- [ ] Logo s hodinami se zobrazuje na login page
- [ ] Logo se zobrazuje na callback page při načítání
- [ ] Logo se zobrazuje na home page
- [ ] Favicon s hodinami v browser tabu

### 2. **Magic Link flow** ✅
- [ ] Email se odešle bez chyby
- [ ] Zobrazí se správná zpráva "Magic link byl odeslán"
- [ ] Callback page zobrazuje "Přihlašuji vás..." v češtině s UTF-8
- [ ] Po úspěchu přesměrování na /home

### 3. **Autorizace** ✅
- [ ] Běžný uživatel nemá přístup na /admin
- [ ] Běžný uživatel nemá přístup na /validate
- [ ] Admin má přístup na všechny stránky
- [ ] Navigation menu zobrazuje správné položky podle role

### 4. **UTF-8 kódování** ✅
- [ ] České znaky se zobrazují správně: "Přihlašuji vás..."
- [ ] "Psychočas" se zobrazuje správně
- [ ] Všechny české texty bez problémů

---

## 🚨 Známé požadavky

### Supabase Dashboard konfigurace
Před testováním ujistěte se, že máte v Supabase Dashboard nastaveno:

**Authentication → URL Configuration → Redirect URLs**:
```
http://localhost:3001/auth/callback
http://localhost:3000/auth/callback
https://psychocas-app-9kj4.vercel.app/auth/callback
```

**Authentication → Email Templates → Magic Link**:
- Nahrajte obsah z `/email-templates/magic-link.html`
- Obsahuje logo s hodinami a Psychočas branding

---

## 📊 Test výsledky

| Test | Status | Poznámky |
|------|--------|----------|
| Běžný user - login | ⏳ | |
| Běžný user - redirect /home | ⏳ | |
| Běžný user - blokace /admin | ⏳ | |
| Admin - login | ⏳ | |
| Admin - přístup /admin | ⏳ | |
| Logo zobrazení | ⏳ | |
| UTF-8 znaky | ⏳ | |
| Magic Link callback | ⏳ | |

---

## 🐛 Troubleshooting

### Magic Link nefunguje?
1. Zkontrolujte browser console (F12) na callback page
2. Hledejte logy: "Starting auth callback...", "URL params:", etc.
3. Ověřte, že URL obsahuje `?token=XXX&type=magiclink`

### Redirect URLs chyba?
1. Ujistěte se, že port je správný (3001 ne 3000)
2. Přidejte obě varianty do Supabase Dashboard

### Admin přístup nefunguje?
1. Zkontrolujte roli v databázi: `SELECT role, email FROM members WHERE email = 'viceprezident@psychocas.cz'`
2. Ujistěte se, že trigger `handle_new_user` běží správně

---

**Datum testu**: 9. října 2025  
**Dev server**: http://localhost:3001  
**Tester**: _____________________
