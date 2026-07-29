/**
 * Verify Stripe checkout prerequisites.
 * Usage: node scripts/test-stripe-setup.mjs
 */
import { readFileSync } from 'fs';

function loadEnv() {
  const env = {};
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i > 0) env[line.slice(0, i)] = line.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY;
const pk = env.VITE_STRIPE_PUBLISHABLE_KEY;

console.log('VITE_STRIPE_PUBLISHABLE_KEY:', pk ? `${pk.slice(0, 12)}...` : 'MISSING');
if (!url || !anon) {
  console.error('Supabase env missing');
  process.exit(1);
}

const res = await fetch(`${url}/functions/v1/create-checkout`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${anon}`,
    apikey: anon,
  },
  body: JSON.stringify({
    action: 'create-setup-intent',
    tier: 'basic',
    email: 'stripe-test@example.com',
    name: 'Stripe Test',
  }),
});

const body = await res.text();
console.log('create-checkout status:', res.status);
if (res.status === 404) {
  console.log('→ Function not deployed. Run: bash scripts/setup-stripe.sh');
  process.exit(1);
}
try {
  const json = JSON.parse(body);
  if (json.clientSecret) {
    console.log('→ Setup intent OK (Stripe secrets configured on server)');
  } else if (json.error) {
    console.log('→ Error:', json.error);
    if (json.error.includes('STRIPE_SECRET_KEY')) {
      console.log('→ Set secrets: bash scripts/setup-stripe.sh');
    }
  }
} catch {
  console.log(body.slice(0, 300));
}