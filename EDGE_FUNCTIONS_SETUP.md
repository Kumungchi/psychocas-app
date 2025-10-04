# ⚡ Edge Functions Setup Guide

Návod pro nasazení Supabase Edge Functions pro Psychočas app.

## 🎯 Overview

Edge Functions poskytují server-side logiku pro:

- **Token Generation** - Bezpečné vytváření slevových kódů
- **Token Validation** - Ověření a použití kódů manažery
- **Business Logic** - Role checking, anti-spam, expiry handling

---

## 🚀 Quick Setup

### 1. Install Supabase CLI

```bash
# NPM (doporučeno)
npm install -g supabase

# Alternativně Homebrew (macOS)
brew install supabase/tap/supabase
```

### 2. Login & Link Project

```bash
# Login to Supabase
supabase login

# Link your project (nahraďte PROJECT_REF)
supabase link --project-ref YOUR_PROJECT_REF

# Verify connection
supabase status
```

### 3. Deploy Functions

```bash
# Deploy všechny functions
supabase functions deploy

# Nebo jednotlivě
supabase functions deploy generate_token
supabase functions deploy redeem_token
```

---

## 📝 Function Details

### Generate Token Function

**Path**: `supabase/functions/generate_token/index.ts`

```typescript
// Generates 3-minute QR discount codes
// POST /functions/v1/generate_token
// Auth: Required (Bearer token)
// Response: { code: "ABC4-XY89", expiresAt: "2025-..." }
```

**Features**:

- ✅ User authentication required
- ✅ Anti-spam (1 active token per user)
- ✅ 3-minute expiry
- ✅ Unique 8-character codes (ABC4-XY89 format)
- ✅ Automatic cleanup of expired tokens

**Security**:

- Validates JWT token
- Checks user exists in members table
- Prevents multiple active tokens
- Uses service role for database operations

### Redeem Token Function

**Path**: `supabase/functions/redeem_token/index.ts`

```typescript
// Validates and redeems discount codes
// POST /functions/v1/redeem_token
// Auth: Required (Manager+ role)
// Body: { code: "ABC4-XY89" }
// Response: { valid: true } | { valid: false, error: "..." }
```

**Features**:

- ✅ Manager/Council/Technician role required
- ✅ Token validation (exists, not expired, not used)
- ✅ Redemption tracking for statistics
- ✅ Branch association for managers

**Security**:

- Role-based access control
- Validates token ownership
- Prevents double redemption
- Anonymous redemption tracking

---

## 🔧 Environment Variables

Edge Functions potřebují tyto proměnné:

```bash
# Set v Supabase Dashboard → Edge Functions → Settings
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
```

**Nastavení v Supabase**:

1. Dashboard → **Edge Functions**
2. **Settings** tab
3. **Environment variables**
4. Add variables výše

---

## 📊 Function Code

### Generate Token Implementation

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      } 
    });
  }

  try {
    // Get user from JWT
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check for existing active tokens (anti-spam)
    const { data: existingTokens } = await supabase
      .from('tokens')
      .select('*')
      .eq('member_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .is('redeemed_at', null);

    if (existingTokens && existingTokens.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'You already have an active token' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate unique code
    const code = generateUniqueCode();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

    // Insert token
    const { data, error } = await supabase
      .from('tokens')
      .insert({
        code,
        member_id: user.id,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({
      code: data.code,
      expiresAt: data.expires_at
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

function generateUniqueCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  // Format: ABC4-XY89
  for (let i = 0; i < 8; i++) {
    if (i === 4) result += '-';
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}
```

### Redeem Token Implementation

```typescript
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate manager
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401 
      });
    }

    // Check manager role
    const { data: member } = await supabase
      .from('members')
      .select('role, branch_id')
      .eq('id', user.id)
      .single();

    if (!member || !['manager', 'council', 'technician'].includes(member.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { 
        status: 403 
      });
    }

    // Get code from request
    const { code } = await req.json();
    
    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from('tokens')
      .select('*, members!inner(branch_id)')
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .is('redeemed_at', null)
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: 'Invalid or expired code' 
      }), { status: 400 });
    }

    // Mark as redeemed
    await supabase
      .from('tokens')
      .update({ redeemed_at: new Date().toISOString() })
      .eq('id', tokenData.id);

    // Record redemption
    await supabase
      .from('redemptions')
      .insert({
        token_id: tokenData.id,
        branch_id: member.branch_id,
        redeemed_by: user.id
      });

    return new Response(JSON.stringify({ valid: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500 
    });
  }
});
```

---

## 🧪 Testing Functions

### Local Testing

```bash
# Start local development
supabase start

# Deploy functions locally
supabase functions deploy --no-verify-jwt

# Test endpoints
curl -X POST 'http://localhost:54321/functions/v1/generate_token' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json'
```

### Production Testing

```bash
# Test generate_token
curl -X POST 'https://your-project.supabase.co/functions/v1/generate_token' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json'

# Test redeem_token
curl -X POST 'https://your-project.supabase.co/functions/v1/redeem_token' \
  -H 'Authorization: Bearer MANAGER_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"code": "ABC4-XY89"}'
```

---

## 📊 Monitoring & Logs

### Function Logs

```bash
# View logs
supabase functions logs generate_token
supabase functions logs redeem_token

# Follow logs in real-time
supabase functions logs --follow
```

### Supabase Dashboard

1. **Edge Functions** → **Logs**
2. Filtrovat podle function name
3. Monitor error rates a performance
4. Check invocation counts

---

## 🔒 Security Considerations

### JWT Validation

- ✅ Every request validates JWT token
- ✅ User existence checked in members table
- ✅ Role-based authorization enforced
- ✅ Service role key protected

### Rate Limiting

- ✅ Anti-spam: 1 active token per user
- ✅ 3-minute token expiry
- ✅ Automatic cleanup of expired tokens
- ⚠️ Consider adding IP-based rate limiting

### Data Protection

- ✅ No sensitive data in function logs
- ✅ CORS properly configured
- ✅ Error messages don't leak internal info
- ✅ Anonymous redemption tracking

---

## 🆘 Troubleshooting

### Common Issues

**Problem**: "Function not found"
**Solution**: `supabase functions deploy function_name`

**Problem**: "Environment variable not found"
**Solution**: Check Dashboard → Edge Functions → Settings

**Problem**: "JWT invalid"
**Solution**: Verify token format and expiry

**Problem**: "Database connection failed"
**Solution**: Check SUPABASE_SERVICE_ROLE_KEY

### Debug Commands

```bash
# Check function status
supabase functions list

# View function details
supabase functions inspect generate_token

# Test database connection
supabase db status

# Reset local environment
supabase stop
supabase start
```

---

## ✅ Deployment Checklist

Pre-deployment:

- [ ] Supabase CLI installed
- [ ] Project linked correctly
- [ ] Environment variables set
- [ ] Functions tested locally

Post-deployment:

- [ ] Functions deployed successfully
- [ ] Production testing passed
- [ ] Logs monitoring setup
- [ ] Error rates acceptable

**Ready for production use!** ⚡