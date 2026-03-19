import { config as loadDotenv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

loadDotenv({ path: '.env', quiet: true })
loadDotenv({ path: '../nextjs-app/.env.local', quiet: true })

type DiscountSeed = {
  id: string
  partner_id: string
  title: string
  description: string | null
  discount_value: string
}

const supabaseUrl =
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE URL or SUPABASE_SERVICE_ROLE_KEY.')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const discounts: DiscountSeed[] = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    partner_id: 'a0000000-0000-0000-0000-000000000001',
    title: '10 % na psychologickou literaturu',
    description: 'Platí na odborné knihy v kamenných pobočkách.',
    discount_value: '10 %',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    partner_id: 'a0000000-0000-0000-0000-000000000002',
    title: '3 měsíce zdarma',
    description: 'Prémiové členství v aplikaci Mindfulness na 3 měsíce.',
    discount_value: 'zdarma',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000003',
    partner_id: 'a0000000-0000-0000-0000-000000000003',
    title: '15 % na všechny nápoje',
    description: 'Sleva pro členy Psychočas každý den.',
    discount_value: '15 %',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000004',
    partner_id: 'a0000000-0000-0000-0000-000000000004',
    title: 'První lekce zdarma',
    description: 'Jedna úvodní lekce zdarma pro nové členy.',
    discount_value: 'zdarma',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000005',
    partner_id: 'a0000000-0000-0000-0000-000000000005',
    title: '20 % na wellness balíček',
    description: 'Platí na všechny wellness balíčky v Brně.',
    discount_value: '20 %',
  },
]

async function resolveCreatorId() {
  const preferredEmails = [
    'technik@psychocas.cz',
    'viceprezident@psychocas.cz',
    'bunnik.matias@seznam.cz',
  ]

  for (const email of preferredEmails) {
    const { data, error } = await admin
      .from('members')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (error) throw error
    if (data?.id) return data.id
  }

  throw new Error('No creator member found. Run setup:test-users first.')
}

async function main() {
  const createdBy = await resolveCreatorId()

  console.log('Seeding test discounts...')
  console.log(`Project: ${supabaseUrl}`)
  console.log(`created_by member id: ${createdBy}`)
  console.log('')

  for (const d of discounts) {
    const payload = {
      id: d.id,
      partner_id: d.partner_id,
      title: d.title,
      description: d.description,
      discount_value: d.discount_value,
      valid_from: null,
      valid_until: null,
      is_active: true,
      created_by: createdBy,
    }

    const { error } = await admin
      .from('discounts')
      .upsert(payload, { onConflict: 'id' })

    if (error) throw error
    console.log(`upserted: ${d.title}`)
  }

  const { count, error: countError } = await admin
    .from('discounts')
    .select('*', { count: 'exact', head: true })

  if (countError) throw countError

  console.log('')
  console.log(`Done. Discounts total: ${count ?? 0}`)
}

void main().catch((error: unknown) => {
  console.error('setup-test-discounts failed:', error)
  process.exit(1)
})
