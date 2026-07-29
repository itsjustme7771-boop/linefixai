/**
 * Quick auth + profiles smoke test.
 * Usage: node scripts/test-auth.mjs [email] [password]
 * If email/password omitted, only checks profiles table + auth settings.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function loadEnv() {
  const env = {};
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const sb = createClient(url, anon);
const [email, password] = process.argv.slice(2);

const { error: tableErr } = await sb.from('profiles').select('id').limit(1);
console.log('profiles_table', tableErr ? `ERROR: ${tableErr.message}` : 'OK');

if (!email || !password) {
  console.log('hint: pass email + password to test sign-in');
  process.exit(tableErr ? 1 : 0);
}

const { data, error } = await sb.auth.signInWithPassword({ email, password });
if (error) {
  console.log('sign_in', 'ERROR:', error.message);
  if (error.message.toLowerCase().includes('email not confirmed')) {
    console.log('hint: confirm your email from the signup message, then retry');
  }
  process.exit(1);
}

console.log('sign_in', 'OK user:', data.user?.id);
const { data: profile, error: pErr } = await sb
  .from('profiles')
  .select('id,email,name,role')
  .eq('id', data.user.id)
  .maybeSingle();
console.log('profile', pErr ? `ERROR: ${pErr.message}` : JSON.stringify(profile));

const { data: sessions, error: sErr } = await sb
  .from('diagnostic_sessions')
  .select('id, issue, created_at')
  .order('created_at', { ascending: false })
  .limit(3);
console.log('sessions', sErr ? `ERROR: ${sErr.message}` : `count=${sessions?.length ?? 0}`);

await sb.auth.signOut();
console.log('done');