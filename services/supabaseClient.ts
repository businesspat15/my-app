// services/supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Vite exposes env vars at import.meta.env
 * So on localhost and Vercel, the correct variables are:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 */

const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase credentials missing. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local (Vite) or Vercel project env.'
  );
} else {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('❌ Failed to initialize Supabase client:', err);
  }
}

export const supabase = client;
