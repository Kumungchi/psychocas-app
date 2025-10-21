import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient, SupabaseClientOptions } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SUPABASE_STORAGE_KEY = "psychocas.auth.session";

const browserStorage =
  typeof window === "undefined"
    ? undefined
    : window.localStorage;

const clientOptions: SupabaseClientOptions<"public"> = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: browserStorage,
    storageKey: SUPABASE_STORAGE_KEY,
  },
};

const missingEnvClient: SupabaseClient = new Proxy({}, {
  get() {
    throw new Error(
      'Supabase client is not configured. Please define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'See DATABASE_SETUP.md for configuration steps.',
    );
  },
}) as SupabaseClient;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, clientOptions)
  : missingEnvClient;
