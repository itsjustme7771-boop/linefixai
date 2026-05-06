import { createClient, SupabaseClient } from '@supabase/supabase-js';

const ENV_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const ENV_ANON = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

const SUPABASE_URL = ENV_URL || 'https://knzzztiryolpiahvreql.supabase.co';
const SUPABASE_ANON_KEY = ENV_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtuenp6dGlyeW9scGlhaHZyZXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNDI0NjMsImV4cCI6MjA5MDkxODQ2M30.ql_irySURoBOK7tZPTK8KLOPegAvZfD6LYHqfhSp5Vw';

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
