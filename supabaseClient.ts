import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper to safely access env vars in various environments (CRA, Vite, Node)
const getEnv = (key: string, viteKey?: string): string => {
  let val = '';
  
  // Check process.env (Standard / CRA / Node)
  try {
    if (typeof process !== 'undefined' && process.env) {
      val = process.env[key] || '';
    }
  } catch (e) {}

  // Check import.meta.env (Vite)
  if (!val && viteKey) {
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        val = import.meta.env[viteKey] || '';
      }
    } catch (e) {}
  }
  return val;
};

const supabaseUrl = getEnv('REACT_APP_SUPABASE_URL', 'VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('REACT_APP_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');

let client: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e);
  }
} else {
  console.warn(
    'Supabase credentials missing. App running in offline mode. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = client;
