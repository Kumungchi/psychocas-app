import { config as loadDotenv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

loadDotenv({ path: '.env', quiet: true })
loadDotenv({ path: '../nextjs-app/.env.local', quiet: true })

type UserRole = 'member' | 'manager' | 'board' | 'technician'

type ManagedAccount = {
  email: string
  fullName: string
  role: UserRole
}

type WhitelistRow = {
  id: string
  branch_id: string
}

type MemberRow = {
  id: string
}

const supabaseUrl =
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const membershipExpiresAt = process.env.MEMBERSHIP_EXPIRES_AT ?? '2027-06-15'

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing SUPABASE URL or SUPABASE_SERVICE_ROLE_KEY in environment.',
  )
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const accounts: ManagedAccount[] = [
  { email: 'technik@psychocas.cz', fullName: 'Technik', role: 'technician' },
  { email: 'viceprezident@psychocas.cz', fullName: 'Vice Prezident', role: 'board' },
  { email: 'bunnik.matias@seznam.cz', fullName: 'Matias Bunnik', role: 'member' },
  { email: 'bednarikova.2003@gmail.com', fullName: 'Bednarikova', role: 'member' },
  { email: 'nina.blaskova19@gmail.com', fullName: 'Nina Blaskova', role: 'member' },
]

async function findAuthUserByEmail(email: string) {
  const target = email.toLowerCase()
  const perPage = 200
  let page = 1

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const existing = data.users.find((user) => user.email?.toLowerCase() === target)
    if (existing) return existing

    if (data.users.length < perPage) return null
    page += 1
  }
}

async function resolveDefaultBranchId() {
  const { data: bunnikWhitelist, error } = await admin
    .from('member_whitelist')
    .select('branch_id')
    .eq('email', 'bunnik.matias@seznam.cz')
    .maybeSingle()

  if (error) throw error
  if (bunnikWhitelist?.branch_id) return bunnikWhitelist.branch_id

  const { data: anyBranch, error: branchError } = await admin
    .from('branches')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (branchError) throw branchError
  if (!anyBranch?.id) {
    throw new Error('No branch found in public.branches.')
  }

  return anyBranch.id
}

async function upsertWhitelist(account: ManagedAccount, branchId: string) {
  const payload = {
    email: account.email.toLowerCase(),
    full_name: account.fullName,
    branch_id: branchId,
    membership_expires_at: membershipExpiresAt,
    is_active: true,
  }

  const { data, error } = await admin
    .from('member_whitelist')
    .upsert(payload, { onConflict: 'email' })
    .select('id, branch_id')
    .single()

  if (error) throw error
  return data as WhitelistRow
}

async function ensureOtpAuthUser(account: ManagedAccount) {
  const existing = await findAuthUserByEmail(account.email)

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      user_metadata: {
        full_name: account.fullName,
      },
    })

    if (error) throw error
    return { action: 'updated' as const, userId: existing.id }
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: account.email.toLowerCase(),
    email_confirm: true,
    user_metadata: {
      full_name: account.fullName,
    },
  })

  if (error || !data.user) throw error ?? new Error(`Failed to create ${account.email}`)
  return { action: 'created' as const, userId: data.user.id }
}

async function upsertMember(account: ManagedAccount, whitelist: WhitelistRow, authUserId: string) {
  const payload = {
    user_id: authUserId,
    whitelist_id: whitelist.id,
    full_name: account.fullName,
    email: account.email.toLowerCase(),
    branch_id: whitelist.branch_id,
    role: account.role,
  }

  const { data: byEmail, error: byEmailError } = await admin
    .from('members')
    .select('id')
    .eq('email', account.email.toLowerCase())
    .maybeSingle()

  if (byEmailError) throw byEmailError
  if (byEmail) {
    const { error } = await admin.from('members').update(payload).eq('id', (byEmail as MemberRow).id)
    if (error) throw error
    return 'updated'
  }

  const { data: byUserId, error: byUserIdError } = await admin
    .from('members')
    .select('id')
    .eq('user_id', authUserId)
    .maybeSingle()

  if (byUserIdError) throw byUserIdError
  if (byUserId) {
    const { error } = await admin.from('members').update(payload).eq('id', (byUserId as MemberRow).id)
    if (error) throw error
    return 'updated'
  }

  const { error: insertError } = await admin.from('members').insert(payload)
  if (insertError) throw insertError
  return 'created'
}

async function removeLegacyTestAccounts() {
  const perPage = 200
  let page = 1
  const idsToDelete: string[] = []

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const matches = data.users
      .filter((user) => user.email?.toLowerCase().endsWith('@psychocas.test'))
      .map((user) => user.id)

    idsToDelete.push(...matches)

    if (data.users.length < perPage) break
    page += 1
  }

  for (const id of idsToDelete) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw error
  }

  const { error: membersError } = await admin
    .from('members')
    .delete()
    .ilike('email', '%@psychocas.test')

  if (membersError) throw membersError

  const { error: whitelistError } = await admin
    .from('member_whitelist')
    .delete()
    .ilike('email', '%@psychocas.test')

  if (whitelistError) throw whitelistError

  return idsToDelete.length
}

async function main() {
  const branchId = await resolveDefaultBranchId()

  console.log('Syncing OTP users + whitelist + roles...')
  console.log(`Project: ${supabaseUrl}`)
  console.log(`Branch: ${branchId}`)
  console.log(`Membership expires at: ${membershipExpiresAt}`)
  console.log('')

  const removed = await removeLegacyTestAccounts()
  console.log(`Removed legacy @psychocas.test auth users: ${removed}`)

  for (const account of accounts) {
    const whitelist = await upsertWhitelist(account, branchId)
    const authResult = await ensureOtpAuthUser(account)
    const memberResult = await upsertMember(account, whitelist, authResult.userId)

    console.log(
      `${account.email} -> whitelist:UPSERT auth:${authResult.action.toUpperCase()} members:${memberResult.toUpperCase()} role:${account.role}`,
    )
  }

  console.log('')
  console.log('Done. OTP-only accounts are ready.')
}

void main().catch((error: unknown) => {
  console.error('setup-test-users failed:', error)
  process.exit(1)
})
