/**
 * Cross-Fix Cards smoke test (requires signed-in user).
 * Usage: node scripts/test-crossfix.mjs email password
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

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: node scripts/test-crossfix.mjs email password');
  process.exit(1);
}

const env = loadEnv();
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email, password });
if (authErr) {
  console.error('sign_in:', authErr.message);
  process.exit(1);
}
console.log('sign_in: OK');

const code = `CFX-${Date.now().toString().slice(-4)}`;
const { data: card, error: insErr } = await sb
  .from('cross_fix_cards')
  .insert({
    code,
    title: 'Smoke test card',
    author: 'test-script',
    author_role: 'technician',
    symptoms: 'Test symptoms',
    solution: 'Test solution',
    status: 'pending',
    helpful: 0,
    parts: [],
    tags: ['test'],
  })
  .select()
  .single();

if (insErr) {
  console.error('insert:', insErr.message);
  process.exit(1);
}
console.log('insert: OK', card.id, card.status);

const { error: delErr } = await sb.from('cross_fix_cards').delete().eq('id', card.id);
console.log('cleanup:', delErr ? delErr.message : 'OK');

await sb.auth.signOut();
console.log('done');