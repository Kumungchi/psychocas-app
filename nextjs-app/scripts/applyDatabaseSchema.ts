import { promises as fs } from 'fs';
import path from 'path';
import { Client } from 'pg';

const SQL_DIRECTORY = path.resolve(process.cwd(), 'sql');
const DEFAULT_ORDER = [
  '01_schema.sql',
  '02_rls_policies.sql',
  '03_triggers.sql',
  '04_views.sql',
  '08_trusted_users.sql',
  '05_test_data.sql',
];

async function loadSqlFiles(): Promise<string[]> {
  const entries = await fs.readdir(SQL_DIRECTORY);
  const ordered = DEFAULT_ORDER.filter((file) => entries.includes(file));
  const missing = DEFAULT_ORDER.filter((file) => !entries.includes(file));

  if (missing.length > 0) {
    throw new Error(`Missing expected SQL files: ${missing.join(', ')}`);
  }

  return ordered.map((file) => path.join(SQL_DIRECTORY, file));
}

async function runSqlFile(client: Client, filePath: string) {
  const sql = await fs.readFile(filePath, 'utf8');
  const label = path.basename(filePath);
  process.stdout.write(`\n▶️  Running ${label}...\n`);
  await client.query(sql);
  process.stdout.write(`✅ Completed ${label}\n`);
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    throw new Error('SUPABASE_DB_URL is required to apply the schema.');
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    const files = await loadSqlFiles();

    for (const file of files) {
      await runSqlFile(client, file);
    }

    process.stdout.write('\n🎉 Database schema applied successfully.\n');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('\n❌ Failed to apply schema');
  console.error(error);
  process.exit(1);
});
