import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

type BranchSeed = {
  id: string;
  name: string;
  city: string | null;
};

type TrustedUserSeed = {
  email: string;
  first_name: string;
  last_name: string;
  role: 'member' | 'manager' | 'council' | 'technician';
  branch_id: string | null;
  phone?: string;
  notes?: string;
};

type MemberSeed = {
  email: string;
  role: 'member' | 'manager' | 'council' | 'technician';
  branch_id: string | null;
  first_name: string;
  last_name: string;
};

const branches: BranchSeed[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Praha',
    city: 'Praha',
  },
  {
    id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    name: 'Brno',
    city: 'Brno',
  },
];

const trustedUsers: TrustedUserSeed[] = [
  {
    email: 'member.tester@psychocas.test',
    first_name: 'Test',
    last_name: 'Člen',
    role: 'member',
    branch_id: branches[0].id,
    notes: 'Ukázkový člen pro testování',
  },
  {
    email: 'manager@psychocas.cz',
    first_name: 'Manažer',
    last_name: 'Pobočky',
    role: 'manager',
    branch_id: branches[0].id,
  },
  {
    email: 'tajemnik@psychocas.cz',
    first_name: 'Tajemník',
    last_name: 'Psychočas',
    role: 'council',
    branch_id: null,
  },
  {
    email: 'viceprezident@psychocas.cz',
    first_name: 'Viceprezident',
    last_name: 'Psychočas',
    role: 'council',
    branch_id: null,
  },
  {
    email: 'prezident@psychocas.cz',
    first_name: 'Prezident',
    last_name: 'Psychočas',
    role: 'council',
    branch_id: null,
  },
  {
    email: 'technik@psychocas.cz',
    first_name: 'Technik',
    last_name: 'Psychočas',
    role: 'technician',
    branch_id: null,
  },
];

const memberSeeds: MemberSeed[] = trustedUsers.map((user) => ({
  email: user.email,
  role: user.role,
  branch_id: user.branch_id,
  first_name: user.first_name,
  last_name: user.last_name,
}));

function ensureEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set to seed Supabase test data.`);
  }
  return value;
}

async function ensureAuthUser(adminClient: SupabaseClient, seed: MemberSeed) {
  const existing = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existingUser = existing.data?.users?.find(
    (user) => user.email?.toLowerCase() === seed.email.toLowerCase()
  );
  if (existingUser) {
    return existingUser;
  }

  const password = `Temp-${randomUUID()}`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email: seed.email,
    email_confirm: true,
    password,
    user_metadata: {
      first_name: seed.first_name,
      last_name: seed.last_name,
    },
  });

  if (error || !data.user) {
    throw error ?? new Error(`Failed to create auth user for ${seed.email}`);
  }

  return data.user;
}

async function seedDatabase() {
  const supabaseUrl = ensureEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY');

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('🌱 Seeding branches...');
  for (const branch of branches) {
    const { error } = await client.from('branches').upsert(branch, { onConflict: 'id' });
    if (error) {
      throw error;
    }
  }

  console.log('🌱 Seeding trusted users...');
  for (const trusted of trustedUsers) {
    const { error } = await client.from('trusted_users').upsert(
      {
        ...trusted,
        added_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    );

    if (error) {
      throw error;
    }
  }

  console.log('🌱 Ensuring auth users and member profiles...');
  for (const member of memberSeeds) {
    console.log(`  • ${member.email}`);
    const authUser = await ensureAuthUser(adminClient, member);
    const membershipExpires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
      .toISOString()
      .slice(0, 10);

    const { error } = await client.from('members').upsert(
      {
        user_id: authUser.id,
        email: member.email,
        role: member.role,
        branch_id: member.branch_id,
        first_name: member.first_name,
        last_name: member.last_name,
        full_name: `${member.first_name} ${member.last_name}`.trim(),
        membership_active: true,
        membership_expires: membershipExpires,
        approved: true,
        approved_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      throw error;
    }
  }

  console.log('\n✅ Supabase test data seeded successfully.');
}

seedDatabase().catch((error) => {
  console.error('\n❌ Failed to seed Supabase test data');
  console.error(error);
  process.exit(1);
});
