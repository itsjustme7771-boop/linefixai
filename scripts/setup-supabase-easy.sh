#!/usr/bin/env bash
# Easiest Supabase setup — no hunting for API keys in the dashboard.
# You only need:
#   1. Your project page URL (copy from browser address bar)
#   2. A CLI access token (one link)
#
# Usage:
#   export SUPABASE_ACCESS_TOKEN=sbp_...
#   bash scripts/setup-supabase-easy.sh "https://supabase.com/dashboard/project/abcdefgh"

set -euo pipefail
cd "$(dirname "$0")/.."

DASHBOARD_URL="${1:-}"

echo ""
echo "=== Easy Supabase Setup (no API key hunting) ==="
echo ""

if ! command -v supabase >/dev/null 2>&1; then
  echo "Install CLI first: brew install supabase/tap/supabase"
  exit 1
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Get ONE token here (click Generate new token):"
  echo "  https://supabase.com/dashboard/account/tokens"
  echo ""
  read -r -p "Paste token (sbp_...): " -s TOKEN
  echo ""
  [[ -n "$TOKEN" ]] || { echo "Token required."; exit 1; }
  export SUPABASE_ACCESS_TOKEN="$TOKEN"
fi

if [[ -z "$DASHBOARD_URL" ]]; then
  echo ""
  echo "Open your project in Supabase (just click it on the home screen)."
  echo "Copy the FULL URL from your browser address bar."
  echo "It looks like: https://supabase.com/dashboard/project/abcdefghijklmnop"
  echo ""
  read -r -p "Paste dashboard URL: " DASHBOARD_URL
fi

# Extract project ref from dashboard URL
PROJECT_REF="$(echo "$DASHBOARD_URL" | sed -n 's|.*/project/\([^/?]*\).*|\1|p')"
if [[ -z "$PROJECT_REF" ]]; then
  echo "Could not read project ID from URL. Paste the full dashboard project URL."
  exit 1
fi

SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
echo ""
echo "Project ref: $PROJECT_REF"
echo "Project URL: $SUPABASE_URL"

echo "Fetching API keys via CLI..."
KEYS_JSON="$(supabase projects api-keys --project-ref "$PROJECT_REF" --output json)"
ANON_KEY="$(echo "$KEYS_JSON" | python3 -c "
import json,sys
keys=json.load(sys.stdin)
for k in keys:
    if k.get('name')=='anon' and k.get('type')=='publishable':
        print(k['api_key']); break
" 2>/dev/null || true)"

if [[ -z "$ANON_KEY" ]]; then
  echo "Could not auto-fetch anon key. Run manually:"
  echo "  supabase projects api-keys --project-ref $PROJECT_REF"
  exit 1
fi

cat > .env <<EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY

VITE_STRIPE_PUBLISHABLE_KEY=
VITE_STRIPE_ACCOUNT_ID=
EOF
echo "Wrote .env"

echo ""
echo "Pushing database tables..."
supabase link --project-ref "$PROJECT_REF" --yes
supabase db push --yes

echo ""
echo "Done! Run: npm run dev"
echo "Optional: deploy AI with"
echo "  supabase secrets set OPENAI_API_KEY=sk-..."
echo "  supabase functions deploy diagnose"
echo ""