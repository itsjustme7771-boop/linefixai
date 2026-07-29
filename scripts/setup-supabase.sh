#!/usr/bin/env bash
# Interactive Supabase setup for linefixai / MTTR.ai
# Run from project root: bash scripts/setup-supabase.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo ""
echo "=== MTTR.ai Supabase Setup ==="
echo ""

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found. Install with:"
  echo "  brew install supabase/tap/supabase"
  exit 1
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Step A — CLI login (one-time)"
  echo "  1. Open: https://supabase.com/dashboard/account/tokens"
  echo "  2. Generate a new access token"
  echo "  3. Run:  export SUPABASE_ACCESS_TOKEN=sbp_your_token"
  echo "  4. Re-run this script"
  echo ""
  read -r -p "Or paste your access token now (hidden): " -s TOKEN
  echo ""
  if [[ -n "$TOKEN" ]]; then
    export SUPABASE_ACCESS_TOKEN="$TOKEN"
  else
    echo "No token provided. Exiting."
    exit 1
  fi
fi

echo ""
echo "Step B — Project details"
echo "  Create a project at https://supabase.com/dashboard if you haven't yet."
echo "  Project Settings → API → copy URL and anon key"
echo "  Project Settings → General → copy Reference ID"
echo ""

read -r -p "Project Reference ID (e.g. abcdefghijklmnop): " PROJECT_REF
read -r -p "Supabase URL (https://$PROJECT_REF.supabase.co): " SUPABASE_URL
SUPABASE_URL="${SUPABASE_URL:-https://${PROJECT_REF}.supabase.co}"
read -r -p "Anon public key (eyJ...): " ANON_KEY

if [[ -z "$PROJECT_REF" || -z "$ANON_KEY" ]]; then
  echo "Project ref and anon key are required."
  exit 1
fi

# Write .env (preserve Stripe lines if present)
if [[ -f .env ]]; then
  cp .env .env.bak
fi

cat > .env <<EOF
# Supabase — your project
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY

# Stripe (optional — leave blank until ready)
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_STRIPE_ACCOUNT_ID=
EOF

echo ""
echo "Wrote .env"

echo ""
echo "Step C — Link project and push database schema..."
supabase link --project-ref "$PROJECT_REF"
supabase db push

echo ""
read -r -p "Step D — Deploy edge functions? Requires OPENAI_API_KEY. [y/N] " DEPLOY
if [[ "$DEPLOY" =~ ^[Yy]$ ]]; then
  read -r -p "OpenAI API key (sk-...): " -s OPENAI_KEY
  echo ""
  if [[ -n "$OPENAI_KEY" ]]; then
    supabase secrets set "OPENAI_API_KEY=$OPENAI_KEY"
    supabase functions deploy diagnose
    supabase functions deploy create-checkout
    echo "Edge functions deployed."
  fi
fi

echo ""
echo "Step E — Enable Realtime (manual, one-time)"
echo "  Dashboard → Database → Replication → enable: cross_fix_cards"
echo ""
echo "Done! Start the app:"
echo "  npm run dev"
echo "  Open http://localhost:8080"
echo ""