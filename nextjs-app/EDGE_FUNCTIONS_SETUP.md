# Edge Functions Setup Guide

## 📋 Kroky pro nasazení Edge Functions

### 1. Instalace Supabase CLI

```bash
# Windows (pomocí npm)
npm install -g supabase

# Nebo přes winget
winget install Supabase.CLI
```

### 2. Přihlášení do Supabase

```bash
supabase login
```

### 3. Inicializace projektu

```bash
cd nextjs-app
supabase init
```

### 4. Propojení s projektem

```bash
supabase link --project-ref wsgmbtcsyccnzfenfucl
```

### 5. Nastavení proměnných prostředí

V Supabase Dashboard → Settings → Edge Functions → Environment Variables:

```
SUPABASE_URL=https://wsgmbtcsyccnzfenfucl.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZ21idGNzeWNjbnpmZW5mdWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MzAxNDcsImV4cCI6MjA3NTEwNjE0N30.0bXbVPURXkw_ywESX8Iqa0ii2wXQ1FKpSKyEFPWwARw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZ21idGNzeWNjbnpmZW5mdWNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTUzMDE0NywiZXhwIjoyMDc1MTA2MTQ3fQ.-RiOBHQoLs1l5fhHV9w-IQEt9pfWtYYZfDfKf5IZfTg
```

### 6. Deploy funkcí

```bash
# Deploy obou funkcí najednou
supabase functions deploy

# Nebo jednotlivě
supabase functions deploy generate_token
supabase functions deploy redeem_token
```

### 7. Testování funkcí

Po deploy budou dostupné na:
- `https://wsgmbtcsyccnzfenfucl.supabase.co/functions/v1/generate_token`
- `https://wsgmbtcsyccnzfenfucl.supabase.co/functions/v1/redeem_token`

## 🧪 Health Check cURL příkazy

### Získání access tokenu
1. Jděte do Supabase Dashboard → Authentication → Users
2. Vytvořte test uživatele nebo se přihlaste přes UI
3. Z browser dev tools zkopírujte `access_token` z localStorage

### Test generate_token

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  https://wsgmbtcsyccnzfenfucl.supabase.co/functions/v1/generate_token
```

**Očekávaný výstup:**
```json
{
  "code": "ABC4-XY89",
  "expiresAt": "2025-10-04T14:03:00.000Z"
}
```

### Test redeem_token (jako manažer)

```bash
curl -X POST \
  -H "Authorization: Bearer MANAGER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"ABC4-XY89"}' \
  https://wsgmbtcsyccnzfenfucl.supabase.co/functions/v1/redeem_token
```

**Očekávaný výstup:**
```json
{
  "valid": true
}
```

## ⚠️ Troubleshooting

### Časté chyby:
- **401 Unauthorized**: Neplatný nebo chybějící access token
- **403 Forbidden**: Uživatel nemá správnou roli (member/manager)
- **membership_inactive**: Uživatel není aktivní člen
- **missing_code**: Chybí kód v request body

### Debug tipy:
```bash
# Zobrazit logy funkcí
supabase functions logs

# Lokální vývoj
supabase functions serve --env-file supabase/functions/.env.example
```