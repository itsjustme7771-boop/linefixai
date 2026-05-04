import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Hardcoded values for this project. Falls back to env vars if ever needed.
const DEFAULT_URL = 'https://btnhqytmpliohvlydrcn.databasepad.com';
const DEFAULT_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImQzYzExNGFmLWZhZWYtNDJjMS1hOTVjLTVlZDVmOGYxMTQ2YyJ9.eyJwcm9qZWN0SWQiOiJidG5ocXl0bXBsaW9odmx5ZHJjbiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc2Njc4NjMwLCJleHAiOjIwOTIwMzg2MzAsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.h4VQTuUVOMmQB-aDDYrgoTHWtXY9O9_bFwhDzTLeVdc';

const ENV_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const ENV_ANON = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

const SUPABASE_URL = ENV_URL || DEFAULT_URL;
const SUPABASE_ANON_KEY = ENV_ANON || DEFAULT_ANON;

export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'mttr.auth.v1',
  },
});

export const SUPABASE_ANON = SUPABASE_ANON_KEY;
export const DIAGNOSE_FN_URL = `${SUPABASE_URL}/functions/v1/diagnose`;
export const CREATE_CHECKOUT_FN_URL = `${SUPABASE_URL}/functions/v1/create-checkout`;
