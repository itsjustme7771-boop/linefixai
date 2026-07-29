#!/usr/bin/env bash
# Stripe + create-checkout edge function setup for linefixai
# Usage: bash scripts/setup-stripe.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo ""
echo "=== MTTR.ai Stripe Setup ==="
echo ""

if ! command -v supabase >/dev/null 2>&1; then
  echo "Install Supabase CLI: brew install supabase/tap/supabase"
  exit 1
fi

PROJECT_REF="$(cat supabase/.temp/project-ref 2>/dev/null || true)"
if [[ -z "$PROJECT_REF" ]]; then
  read -r -p "Supabase project ref (e.g. knzzztiryolpiahvreql): " PROJECT_REF
  supabase link --project-ref "$PROJECT_REF" --yes
fi

echo ""
echo "Step 1 — Stripe test keys"
echo "  Dashboard → https://dashboard.stripe.com/test/apikeys"
echo ""

read -r -p "Publishable key (pk_test_...): " PK
read -r -s -p "Secret key (sk_test_...): " SK
echo ""

if [[ -z "$PK" || -z "$SK" ]]; then
  echo "Both keys are required."
  exit 1
fi

echo ""
echo "Step 2 — Create 3 recurring prices in Stripe"
echo "  Products → Add product → Recurring monthly:"
echo "    Basic    \$9.99/mo"
echo "    Advanced \$24.99/mo"
echo "    Premium  \$54.99/mo"
echo "  Copy each Price ID (price_...)"
echo ""

read -r -p "STRIPE_PRICE_BASIC (price_...): " PRICE_BASIC
read -r -p "STRIPE_PRICE_ADVANCED (price_...): " PRICE_ADVANCED
read -r -p "STRIPE_PRICE_PREMIUM (price_...): " PRICE_PREMIUM

read -r -p "Stripe Connect account ID (acct_..., or leave blank): " ACCT_ID

echo ""
echo "Step 3 — Write .env (preserving Supabase keys)..."
SUPABASE_URL="$(grep '^VITE_SUPABASE_URL=' .env 2>/dev/null | cut -d= -f2- || true)"
ANON_KEY="$(grep '^VITE_SUPABASE_ANON_KEY=' .env 2>/dev/null | cut -d= -f2- || true)"

if [[ -z "$SUPABASE_URL" || -z "$ANON_KEY" ]]; then
  echo "Missing Supabase keys in .env — run scripts/setup-supabase-easy.sh first."
  exit 1
fi

cat > .env <<EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY

VITE_STRIPE_PUBLISHABLE_KEY=$PK
VITE_STRIPE_ACCOUNT_ID=$ACCT_ID
EOF
echo "Wrote .env"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo ""
  echo "Step 4 — Supabase CLI token (for secrets + deploy)"
  echo "  https://supabase.com/dashboard/account/tokens"
  read -r -s -p "Access token (sbp_...): " TOKEN
  echo ""
  [[ -n "$TOKEN" ]] && export SUPABASE_ACCESS_TOKEN="$TOKEN"
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo ""
  echo "No access token — set secrets manually in Dashboard → Edge Functions → Secrets:"
  echo "  STRIPE_SECRET_KEY, STRIPE_PRICE_BASIC, STRIPE_PRICE_ADVANCED, STRIPE_PRICE_PREMIUM"
  echo "Then deploy: supabase functions deploy create-checkout"
  exit 0
fi

echo ""
echo "Step 5 — Push DB migration (subscription fields)..."
supabase db push --yes

echo ""
echo "Step 6 — Set edge function secrets..."
supabase secrets set \
  "STRIPE_SECRET_KEY=$SK" \
  "STRIPE_PRICE_BASIC=$PRICE_BASIC" \
  "STRIPE_PRICE_ADVANCED=$PRICE_ADVANCED" \
  "STRIPE_PRICE_PREMIUM=$PRICE_PREMIUM"

if [[ -n "$ACCT_ID" ]]; then
  supabase secrets set "STRIPE_ACCOUNT_ID=$ACCT_ID"
fi

echo ""
echo "Step 7 — Deploy create-checkout function..."
supabase functions deploy create-checkout

echo ""
echo "Done! Restart dev server:"
echo "  npm run dev"
echo ""
echo "Test: sign in → Pricing → Start Basic → use card 4242 4242 4242 4242"
echo ""