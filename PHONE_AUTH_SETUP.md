# Phone Number Authentication Setup Guide

This guide explains how to set up and use the phone number authentication system for the Psychočas app.

## Overview

The Psychočas app uses a **phone number + OTP (One-Time Password)** authentication system where:

1. Users enter their phone number
2. An OTP code is sent **via email** (from `no-reply@psychocas.cz`)
3. Users enter the 6-digit code to complete authentication
4. Only trusted users (in the `membership_whitelist` table) can authenticate

**Key Features:**
- Phone numbers are the primary authentication identifier
- OTP codes are delivered via email (not SMS) for cost efficiency
- Users must be pre-provisioned via the whitelist system
- Supports PWA offline functionality after initial authentication

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Configuration](#supabase-configuration)
3. [Database Setup](#database-setup)
4. [User Provisioning](#user-provisioning)
5. [Testing](#testing)
6. [PWA Functionality](#pwa-functionality)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before setting up phone authentication, ensure you have:

- Supabase project with admin access
- Node.js 18+ and npm installed
- Database access (SQL editor or CLI)
- Email service configured in Supabase (for OTP delivery)

---

## Supabase Configuration

### Step 1: Enable Phone Authentication

1. Go to your Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Phone** provider
3. Configure the following settings:

```
Phone Provider Settings:
├── Enable Phone Sign-ups: ✓ ON
├── Confirm Phone: ✓ ON
├── Phone Template: Use email delivery (see below)
└── OTP Expiry: 60 seconds (default)
```

### Step 2: Configure Email-Based OTP Delivery

Since we're sending OTP codes via email instead of SMS, you need to configure Supabase to use a custom email template for phone OTP.

1. Go to **Authentication** → **Email Templates**
2. Find or create **Phone OTP** template
3. Use the following template:

**Subject:**
```
Your Psychočas verification code
```

**Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1d4f7d 0%, #049edb 100%); padding: 40px 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">Psychočas</h1>
    </div>

    <!-- Content -->
    <div style="padding: 40px 30px;">
      <h2 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">Your Verification Code</h2>

      <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
        Enter the following code to sign in to your Psychočas account:
      </p>

      <!-- OTP Code -->
      <div style="background: #f0f9ff; border: 2px solid #049edb; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 30px 0;">
        <div style="font-size: 36px; font-weight: bold; color: #1d4f7d; letter-spacing: 8px; font-family: 'Courier New', monospace;">
          {{ .Token }}
        </div>
      </div>

      <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0 0 15px 0;">
        This code will expire in <strong>60 seconds</strong>.
      </p>

      <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0;">
        If you didn't request this code, you can safely ignore this email.
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #f5f5f5; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
      <p style="color: #999; font-size: 12px; margin: 0; text-align: center;">
        This is an automated message from Psychočas. Please do not reply to this email.
      </p>
    </div>

  </div>
</body>
</html>
```

### Step 3: Configure Email Sender

1. Go to **Settings** → **Authentication**
2. Set **Site URL**: `https://your-domain.com` (production URL)
3. Set **Redirect URLs**: Add `https://your-domain.com/auth/callback`
4. Configure **SMTP Settings** (or use Supabase's default):

```
SMTP Settings (Optional - for custom sender):
├── SMTP Host: smtp.gmail.com (or your provider)
├── SMTP Port: 587
├── SMTP User: no-reply@psychocas.cz
├── SMTP Password: [your app password]
└── From Email: no-reply@psychocas.cz
```

---

## Database Setup

### Step 1: Apply the Phone Auth Migration

Run the database migration script to update the schema:

```bash
cd nextjs-app
npm run deploy:schema sql/09_phone_auth_migration.sql
```

Or manually execute in Supabase SQL Editor:

```sql
-- Copy contents of sql/09_phone_auth_migration.sql
```

This migration:
- Adds `phone` column to `membership_whitelist` (if not exists)
- Makes `email` optional (phone becomes primary identifier)
- Updates `ensure_membership_from_whitelist()` RPC to match on phone numbers
- Adds indexes for phone lookups

### Step 2: Verify Schema

Check that the following tables have been updated:

```sql
-- Check membership_whitelist structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'membership_whitelist'
ORDER BY ordinal_position;

-- Expected columns:
-- id, email (nullable), phone (nullable), first_name, last_name,
-- role, branch_id, note, invited_by, invited_at, consumed_at, consumed_by, active
```

---

## User Provisioning

### Understanding the Whitelist System

The Psychočas app uses a **whitelist-based** authentication system:

1. **Membership Whitelist**: Contains trusted users (phone numbers + metadata)
2. **Auth Users**: Created by provisioning script from the whitelist
3. **Memberships Table**: Synced automatically on first login via RPC

### Step 1: Populate the Whitelist

Add trusted users to the `membership_whitelist` table:

```sql
-- Example: Add a member
INSERT INTO public.membership_whitelist (
  phone,
  email,
  first_name,
  last_name,
  role,
  branch_id,
  active
)
VALUES (
  '+420123456789',           -- Phone number in E.164 format
  'user@example.com',        -- Optional email
  'Jan',                     -- First name
  'Novák',                   -- Last name
  'member',                  -- Role: member|manager|council|technician|admin
  (SELECT id FROM branches WHERE name = 'Praha'),  -- Branch ID
  true                       -- Active status
);

-- Bulk import from CSV
COPY public.membership_whitelist (phone, email, first_name, last_name, role, branch_id, active)
FROM '/path/to/users.csv'
DELIMITER ','
CSV HEADER;
```

**CSV Format:**
```csv
phone,email,first_name,last_name,role,branch_id,active
+420123456789,jan.novak@example.com,Jan,Novák,member,branch-uuid-here,true
+420987654321,eva.svobodova@example.com,Eva,Svobodová,manager,branch-uuid-here,true
```

### Step 2: Run the Provisioning Script

The provisioning script creates Supabase auth users for all whitelist entries:

```bash
# Dry run (preview changes without creating users)
npm run provision:users -- --dry-run

# Provision all users
npm run provision:users

# Provision a specific phone number
npm run provision:users -- --phone=+420123456789
```

**What the script does:**
1. Reads all active entries from `membership_whitelist`
2. Normalizes phone numbers to E.164 format
3. Creates Supabase auth users with phone authentication enabled
4. Sets user metadata (name, role)
5. Skips users that already exist

**Example Output:**
```
🚀 Psychočas User Provisioning Script
=====================================

📋 Found 10 active whitelist entries

📱 Processing: +420123456789
   Name: Jan Novák
   Email: jan.novak@example.com
   Role: member
   ✅ Created auth user: a1b2c3d4-...

=====================================
📊 Provisioning Summary
=====================================
✅ Successfully provisioned: 8
⏭️  Skipped (already exist): 2
❌ Failed: 0
📱 Total processed: 10
```

### Step 3: Verify Users Were Created

Check in Supabase Dashboard → **Authentication** → **Users**:

- Users should appear with phone numbers
- `phone_confirmed_at` should be set
- User metadata should contain `first_name`, `last_name`, `role`

---

## Testing

### Test the Login Flow

1. **Open the app** at `http://localhost:3000/login` (dev) or your production URL

2. **Enter a whitelisted phone number**:
   - Format: `+420123456789` or `123456789` (without prefix)
   - Click "Send verification code"

3. **Check your email**:
   - Look for email from `no-reply@psychocas.cz` (or default Supabase sender)
   - Subject: "Your Psychočas verification code"
   - Body contains 6-digit code

4. **Enter the OTP code**:
   - Type the 6-digit code
   - Click "Verify code and sign in"

5. **Verify successful login**:
   - You should be redirected to `/home`
   - Your membership should be created automatically
   - Session should persist across page refreshes

### Test Error Cases

**Non-whitelisted phone number:**
```
Error: "Phone number not authorized. Contact admin to be added to the system."
```

**Expired OTP code:**
```
Error: "Verification code has expired. Request a new code."
```

**Invalid OTP code:**
```
Error: "Invalid verification code. Please check the code."
```

**Rate limiting:**
```
Error: "You reached the link request limit. Wait a minute and try again."
```

---

## PWA Functionality

### Session Persistence

The app uses **persistent sessions** via cookies:

- Sessions are stored in browser cookies (managed by Supabase SSR)
- Sessions persist across:
  - Page refreshes
  - Browser restarts
  - Device reboots (if PWA is installed)

**Implementation:**
- `/src/middleware.ts`: Validates sessions on every request
- `/src/hooks/useAuth.tsx`: Hydrates session on app load
- Cookies: `sb-access-token`, `sb-refresh-token`

### Offline Support

After logging in at least once:

1. **Home page caching**:
   - Member data, partners, and last token are cached in `localStorage`
   - Cache key: `psychocas_home_snapshot`
   - Refreshed on every successful load

2. **Offline detection**:
   - `useNetworkStatus()` hook monitors online/offline state
   - Offline toast appears when connection is lost

3. **Graceful degradation**:
   - Read-only access to cached data
   - Token generation disabled offline
   - Sync happens automatically when online

**Test offline mode:**
1. Log in and visit `/home`
2. Turn off network (Chrome DevTools → Network → Offline)
3. Refresh the page
4. Verify cached data is displayed
5. Try to generate a token → Should show offline error

### PWA Installation

**Desktop (Chrome/Edge):**
1. Visit the app URL
2. Click install icon in address bar
3. App opens in standalone window

**Mobile (iOS/Android):**
1. Open in Safari/Chrome
2. Tap "Share" → "Add to Home Screen"
3. App appears as native icon
4. Opens fullscreen without browser UI

**Testing PWA features:**
- **Standalone mode**: App runs without browser chrome
- **Push notifications**: (Not yet implemented)
- **Background sync**: (Not yet implemented)
- **Offline-first**: Works without network after initial load

---

## Troubleshooting

### Issue: OTP emails not arriving

**Possible causes:**
1. SMTP not configured correctly
2. Emails going to spam folder
3. Supabase free tier email limits reached

**Solutions:**
- Check Supabase Dashboard → Settings → Authentication → SMTP
- Verify sender email is not blacklisted
- Check spam folder
- Use custom SMTP provider (Gmail, SendGrid, Mailgun)

### Issue: "Phone number not authorized"

**Cause:** User is not in the `membership_whitelist` table

**Solution:**
```sql
-- Add user to whitelist
INSERT INTO public.membership_whitelist (phone, first_name, last_name, role, active)
VALUES ('+420123456789', 'Jan', 'Novák', 'member', true);

-- Then run provisioning script
npm run provision:users -- --phone=+420123456789
```

### Issue: Session not persisting

**Possible causes:**
1. Cookies blocked by browser
2. Third-party cookies disabled
3. Incognito/private mode

**Solutions:**
- Enable cookies in browser settings
- Disable "Block third-party cookies"
- Use normal browsing mode (not incognito)
- Check `/auth/callback` redirects properly

### Issue: PWA not installable

**Requirements for PWA installation:**
1. Served over HTTPS (or localhost for dev)
2. Valid `manifest.json`
3. Service worker registered
4. Minimum set of icons

**Verify:**
- Chrome DevTools → Application → Manifest
- Check for errors in console
- Ensure `next-pwa` is configured in `next.config.ts`

### Issue: Middleware redirecting authenticated users

**Check:**
1. Session cookies are being set correctly
2. `/src/middleware.ts` is recognizing the session
3. User exists in `memberships` table

**Debug:**
```typescript
// Add logging to middleware.ts
console.log('Session:', session);
console.log('User:', session?.user);
```

---

## Security Considerations

### Phone Number Validation

- Phone numbers are normalized to E.164 format
- Czech Republic (+420) is assumed as default country code
- Validation happens both client-side and server-side

### Rate Limiting

Supabase automatically rate-limits OTP requests:
- Default: 1 OTP per minute per phone number
- Can be configured in Supabase Dashboard

### Session Security

- Sessions expire after 1 hour of inactivity (configurable)
- Refresh tokens valid for 30 days
- All requests must include valid session cookies
- Row-Level Security (RLS) enforces authorization

### Best Practices

1. **Never expose service role key** in client code
2. **Use environment variables** for sensitive config
3. **Enable RLS** on all tables
4. **Audit whitelist regularly** to remove inactive users
5. **Monitor auth logs** in Supabase Dashboard
6. **Use HTTPS** in production
7. **Rotate SMTP credentials** periodically

---

## Migration from Email Auth

If migrating from the old email magic-link system:

### Step 1: Backup Current Data

```sql
-- Backup memberships
CREATE TABLE memberships_backup AS SELECT * FROM memberships;

-- Backup whitelist
CREATE TABLE membership_whitelist_backup AS SELECT * FROM membership_whitelist;
```

### Step 2: Add Phone Numbers to Whitelist

```sql
-- Update existing whitelist entries with phone numbers
UPDATE public.membership_whitelist
SET phone = '+420123456789'  -- Replace with actual phone
WHERE email = 'user@example.com';
```

### Step 3: Re-provision Users

```bash
# Delete old auth users (optional)
# Go to Supabase Dashboard → Authentication → Users → Delete

# Provision new phone-based users
npm run provision:users
```

### Step 4: Update Login Page

Replace `/src/app/login/page.tsx` with `/src/app/login/page-phone.tsx`:

```bash
cd nextjs-app/src/app/login
mv page.tsx page-email.tsx.bak
mv page-phone.tsx page.tsx
```

### Step 5: Test Migration

1. Test login with phone numbers
2. Verify memberships are synced correctly
3. Check that existing tokens still work
4. Test PWA offline functionality

---

## Appendix

### Environment Variables

Required in `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Server-side only, never expose to client
```

### Database Schema Reference

```sql
-- membership_whitelist
CREATE TABLE public.membership_whitelist (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text,                    -- Optional, used for notifications
  phone text UNIQUE,             -- Primary auth identifier (E.164 format)
  first_name text,
  last_name text,
  role text NOT NULL CHECK (role IN ('member','manager','council','technician','admin')),
  branch_id uuid REFERENCES public.branches(id),
  note text,
  invited_by uuid REFERENCES public.memberships(user_id),
  invited_at timestamptz DEFAULT now(),
  consumed_at timestamptz,
  consumed_by uuid REFERENCES public.memberships(user_id),
  active boolean DEFAULT true,
  CONSTRAINT membership_whitelist_email_or_phone_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- memberships
CREATE TABLE public.memberships (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  phone text UNIQUE,             -- Synced from auth.users
  first_name text,
  last_name text,
  full_name text,
  branch_id uuid REFERENCES public.branches(id),
  role text NOT NULL CHECK (role IN ('member','manager','council','technician','admin')),
  membership_active boolean NOT NULL DEFAULT false,
  membership_expires date,
  approved boolean DEFAULT false,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.memberships(user_id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Phone Number Format Reference

**E.164 Format:**
- `+[country code][subscriber number]`
- Example: `+420123456789` (Czech Republic)

**Supported Input Formats:**
- `+420123456789` (E.164 - preferred)
- `420123456789` (without +, assumed Czech)
- `123456789` (without country code, +420 added automatically)
- `+420 123 456 789` (with spaces, normalized automatically)

**Normalization Logic:**
```typescript
function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/[\s\-()]/g, '');
  if (!normalized.startsWith('+')) {
    if (normalized.startsWith('0')) {
      normalized = normalized.substring(1);
    }
    normalized = '+420' + normalized;
  }
  return normalized;
}
```

---

## Support

For issues or questions:
- Check the [main README](./README.md)
- Review [DATABASE_SETUP.md](./DATABASE_SETUP.md)
- Open an issue on GitHub
- Contact: dev@psychocas.cz

---

**Last updated:** 2025-12-07
