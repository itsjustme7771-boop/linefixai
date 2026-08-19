import { createClient } from '@supabase/supabase-js';

interface LineFixImportMeta extends ImportMeta {
  env: Record<string, string | undefined>;
}

const env = (import.meta as LineFixImportMeta).env;
const SUPABASE_URL = env.VITE_SUPABASE_URL?.trim();
const SUPABASE_PUBLISHABLE_KEY = (
  env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY
)?.trim();

export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export const supabase = hasSupabase
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'linefix.auth.v1',
      },
    })
  : null;

export const DIAGNOSE_FN_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/diagnose`
  : null;

export interface LineFixActor {
  userId: string;
  organizationId: string;
}

export async function requireLineFixActor(): Promise<LineFixActor> {
  if (!supabase) throw new Error('LineFix backend is not configured');

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Please sign in to continue');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (profileError || !profile?.organization_id) {
    throw new Error('Your technician profile is not ready');
  }

  return { userId: user.id, organizationId: profile.organization_id };
}
