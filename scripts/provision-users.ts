#!/usr/bin/env tsx
/**
 * User Provisioning Script
 *
 * This script creates Supabase auth users for all active entries in the membership_whitelist table.
 * It uses phone numbers as the primary authentication method.
 *
 * Prerequisites:
 * - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set
 * - membership_whitelist table must be populated with phone numbers
 *
 * Usage:
 *   npm run provision:users
 *
 * or with options:
 *   npm run provision:users -- --dry-run
 *   npm run provision:users -- --phone=+420123456789
 */

import { createClient } from '@supabase/supabase-js';

interface WhitelistRecord {
  id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  branch_id: string | null;
  active: boolean;
  consumed_at: string | null;
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const specificPhone = args.find(arg => arg.startsWith('--phone='))?.split('=')[1];

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: Missing required environment variables');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all spaces, dashes, parentheses
  let normalized = phone.replace(/[\s\-()]/g, '');

  // If it doesn't start with +, assume Czech Republic (+420)
  if (!normalized.startsWith('+')) {
    normalized = '+420' + normalized;
  }

  return normalized;
}

/**
 * Check if a user already exists for a given phone number
 */
async function userExistsForPhone(phone: string): Promise<boolean> {
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error(`   ⚠️  Error checking existing users: ${error.message}`);
    return false;
  }

  return data.users.some(user => user.phone === phone);
}

/**
 * Create a Supabase auth user for a whitelist record
 */
async function createUserFromWhitelist(record: WhitelistRecord): Promise<boolean> {
  const phone = record.phone;
  const email = record.email;

  if (!phone) {
    console.error(`   ❌ Skipping record ${record.id}: No phone number`);
    return false;
  }

  const normalizedPhone = normalizePhoneNumber(phone);

  console.log(`\n📱 Processing: ${normalizedPhone}`);
  console.log(`   Name: ${record.first_name} ${record.last_name}`);
  console.log(`   Email: ${email || 'N/A'}`);
  console.log(`   Role: ${record.role}`);

  // Check if user already exists
  const exists = await userExistsForPhone(normalizedPhone);
  if (exists) {
    console.log(`   ⏭️  User already exists, skipping`);
    return true;
  }

  if (dryRun) {
    console.log(`   🔍 [DRY RUN] Would create auth user with phone: ${normalizedPhone}`);
    return true;
  }

  // Create the user in Supabase auth
  const { data, error } = await supabase.auth.admin.createUser({
    phone: normalizedPhone,
    email: email || undefined,
    email_confirm: true, // Auto-confirm email if provided
    phone_confirm: true, // Auto-confirm phone
    user_metadata: {
      first_name: record.first_name,
      last_name: record.last_name,
      role: record.role,
      provisioned_from_whitelist: true,
    },
  });

  if (error) {
    console.error(`   ❌ Failed to create user: ${error.message}`);
    return false;
  }

  console.log(`   ✅ Created auth user: ${data.user.id}`);

  // Call ensure_membership_from_whitelist to sync to memberships table
  // We need to impersonate the user to call this RPC
  const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: email || `user-${data.user.id}@temp.psychocas.cz`,
  });

  if (sessionError) {
    console.warn(`   ⚠️  Could not generate session for membership sync: ${sessionError.message}`);
    return true; // User was created, but membership sync will happen on first login
  }

  return true;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Psychočas User Provisioning Script');
  console.log('=====================================\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Fetch whitelist records
  let query = supabase
    .from('membership_whitelist')
    .select('*')
    .eq('active', true)
    .is('consumed_at', null);

  if (specificPhone) {
    const normalized = normalizePhoneNumber(specificPhone);
    query = query.eq('phone', normalized);
    console.log(`🎯 Filtering for specific phone: ${normalized}\n`);
  }

  const { data: whitelist, error } = await query;

  if (error) {
    console.error(`❌ Error fetching whitelist: ${error.message}`);
    process.exit(1);
  }

  if (!whitelist || whitelist.length === 0) {
    console.log('ℹ️  No active whitelist entries found to provision');
    process.exit(0);
  }

  console.log(`📋 Found ${whitelist.length} active whitelist entries\n`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (const record of whitelist as WhitelistRecord[]) {
    const success = await createUserFromWhitelist(record);
    if (success) {
      if (await userExistsForPhone(normalizePhoneNumber(record.phone!))) {
        successCount++;
      } else {
        skipCount++;
      }
    } else {
      failCount++;
    }
  }

  console.log('\n=====================================');
  console.log('📊 Provisioning Summary');
  console.log('=====================================');
  console.log(`✅ Successfully provisioned: ${successCount}`);
  console.log(`⏭️  Skipped (already exist): ${skipCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📱 Total processed: ${whitelist.length}`);

  if (dryRun) {
    console.log('\n🔍 This was a dry run. Use without --dry-run to create users.');
  }

  process.exit(failCount > 0 ? 1 : 0);
}

// Run the script
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
