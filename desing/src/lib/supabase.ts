import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// These come from your .env file.
// import.meta.env is how Vite reads environment variables in the browser.
// The VITE_ prefix is required — without it, Vite strips the variable for security.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

// This is the single Supabase client used throughout the entire app.
// It handles: database queries, auth sessions, realtime subscriptions.
// The "anon key" is safe to expose in the browser — it's limited by Row Level Security (RLS).
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session in localStorage so users stay logged in after refreshing
    persistSession: true,
    autoRefreshToken: true,
    // OTP flow does not use magic-link URL params
    detectSessionInUrl: false,
  },
})
