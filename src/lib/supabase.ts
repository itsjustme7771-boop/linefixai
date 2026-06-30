import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabaseConfig } from './env';

export const hasSupabase = hasSupabaseConfig;

const url = env.supabaseUrl ?? '';
const anonKey = env.supabaseAnonKey ?? '';

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'mttr.auth.v1',
      },
    })
  : null;

export const SUPABASE_ANON = anonKey;
export const DIAGNOSE_FN_URL = hasSupabase ? `${url}/functions/v1/diagnose` : null;
export const CREATE_CHECKOUT_FN_URL = hasSupabase ? `${url}/functions/v1/create-checkout` : null;