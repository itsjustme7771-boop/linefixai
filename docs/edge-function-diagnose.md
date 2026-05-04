# Diagnose Edge Function — Deployment Guide

Updated for LineFixAI v2 with the production system prompt.

The frontend in `src/lib/diagnosticStream.ts` automatically prefers this edge function when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. Without those env vars, the UI streams the mock response instead — so local dev works without a backend.

---

## Compliance Note

The system prompt and knowledge base are built from **general industrial knowledge and personal field experience** — not from any employer's proprietary documents. Do not include Tyson Foods, DSI, or any company-specific schematic content in the prompt or reference context. Equipment designations, failure patterns, and diagnostic procedures are derived from public manufacturer documentation and publicly available industry standards.

---

## 1. Environment Variables

### Frontend (`.env`)
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

### Edge Function Secrets
Set via `supabase secrets set ...`:

```bash
# For OpenAI:
OPENAI_API_KEY=sk-...

# OR for Anthropic (recommended):
ANTHROPIC_API_KEY=sk-ant-...

# Optional: enable RAG from a knowledge base table
SUPABASE_KB_TABLE=equipment_kb
SUPABASE_KB_BODY_COLS=equipment_type,error_code,symptoms,root_cause,fix,prevention

SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

---

## 2. SQL — Diagnostic Sessions Table

```sql
create table if not exists public.diagnostic_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  equipment_id   text,
  issue          text not null,
  response       text not null default '',
  outcome        text check (outcome in ('fixed','refine')),
  created_at     timestamptz not null default now()
);

alter table public.diagnostic_sessions enable row level security;

create policy "own_rows_select" on public.diagnostic_sessions
  for select using (auth.uid() = user_id);

create policy "own_rows_insert" on public.diagnostic_sessions
  for insert with check (auth.uid() = user_id);

create policy "own_rows_update" on public.diagnostic_sessions
  for update using (auth.uid() = user_id);

create index diagnostic_sessions_user_created_idx
  on public.diagnostic_sessions (user_id, created_at desc);
```

### Optional: Equipment Knowledge Base Table (for RAG)
```sql
create table if not exists public.equipment_kb (
  id            uuid primary key default gen_random_uuid(),
  equipment_type text not null,
  error_code    text,
  symptoms      text,
  root_cause    text,
  fix           text,
  prevention    text,
  created_at    timestamptz not null default now()
);

create index equipment_kb_fts_idx on public.equipment_kb
  using gin(to_tsvector('english', equipment_type || ' ' || coalesce(error_code,'') || ' ' || coalesce(symptoms,'')));
```

---

## 3. System Prompt

The edge function ships with the production prompt hardcoded. See `docs/system-prompt.md` for the full documented version.

Key characteristics:
- Lead Maintenance Technician persona — 18 years food processing
- Four-section mandatory response structure: Safety → Causes → 60-Second Check → Steps
- Strong constraints: minimize downtime, work with what's on hand, flag safety first
- Feedback loop paragraph at end (refinement flow)
- No proprietary content — general industrial knowledge only

---

## 4. Deploy the Edge Function

```bash
cd supabase/functions/diagnose

# Deploy (no JWT verification — uses service role key instead)
supabase functions deploy diagnose --no-verify-jwt

# Set secrets
supabase secrets set OPENAI_API_KEY=sk-...
# OR
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

supabase secrets set SUPABASE_URL=https://<project>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<key>

# Optional: enable RAG
supabase secrets set SUPABASE_KB_TABLE=equipment_kb
```

---

## 5. Anthropic vs OpenAI

The edge function auto-detects which API key is set:

- `ANTHROPIC_API_KEY` set → uses Claude 3.5 Sonnet via `/v1/messages`
- `OPENAI_API_KEY` set → uses GPT-4o-mini via `/v1/chat/completions`
- Both set → Anthropic takes priority

The frontend's `diagnosticStream.ts` already handles both SSE formats:
- OpenAI: `choices[0].delta.content`
- Anthropic: `delta.text`

---

## 6. Testing

### Local development (no backend)
1. Clone the repo
2. `npm install && npm run dev`
3. App runs in demo mode — mock diagnostic response streams

### With Supabase + AI
1. Create a Supabase project
2. Run the SQL migrations
3. Deploy the edge function with your API key
4. Add `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
5. `npm run dev`

### Test the edge function directly
```bash
curl -X POST https://<project>.supabase.co/functions/v1/diagnose \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"issue": "Conveyor belt keeps stopping mid-cycle, no fault code", "equipmentId": "EQ-001"}'
```