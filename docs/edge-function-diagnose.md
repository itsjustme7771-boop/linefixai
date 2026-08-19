# Diagnose Edge Function — Deployment Guide

This document contains the Supabase edge function that powers the live diagnostic
engine, the SQL migration for session persistence, and the environment variables
the frontend needs to call it.

The frontend in `src/lib/diagnosticStream.ts` will automatically prefer this
edge function when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set.
When those env vars are missing the UI streams a realistic mock response instead,
so everything still works in local development without a backend.

---

## 1. Environment variables

Frontend (`.env`):

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

Edge function secrets (set with `supabase secrets set ...`):

```
OPENAI_API_KEY=sk-...
# or, to use Anthropic:
# ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

---

## 2. SQL migration — `diagnostic_sessions`

```sql
create table if not exists public.diagnostic_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  equipment_id  text,
  issue         text not null,
  response      text not null default '',
  outcome       text check (outcome in ('fixed','refine')) ,
  created_at    timestamptz not null default now()
);

alter table public.diagnostic_sessions enable row level security;

-- Every authenticated user can read/insert their own rows.
create policy "own_rows_select" on public.diagnostic_sessions
  for select using (auth.uid() = user_id);

create policy "own_rows_insert" on public.diagnostic_sessions
  for insert with check (auth.uid() = user_id);

create policy "own_rows_update" on public.diagnostic_sessions
  for update using (auth.uid() = user_id);

create index diagnostic_sessions_user_created_idx
  on public.diagnostic_sessions (user_id, created_at desc);
```

---

## 3. System prompt (mandatory response format)

The function sends this exact prompt to the LLM so every answer follows the
strict plant-floor structure the UI parser expects.

```
You are an Industrial Maintenance Diagnostic Engine for high-speed manufacturing.
Think and write like an experienced lead maintenance technician on a noisy plant
floor. Be concise, scannable, command-style.

MANDATORY RESPONSE STRUCTURE (use these exact headers, in this order):

1. SAFETY FIRST
- Identify hazards: high voltage, stored energy (air/hydraulic/mechanical),
  moving parts, heat.
- State required safety actions: LOTO, bleed air, verify zero-energy.

2. TOP 3 PROBABLE CAUSES
Ranked by real-world frequency. Format as:
1. <cause> — <one-line detail>
2. <cause> — <one-line detail>
3. <cause> — <one-line detail>
Bias toward: sensors, electrical (power/overloads/fuses), safety circuits,
post-sanitation issues (loose wires, misconnected airlines), disconnects OFF.

3. 60-SECOND CHECK (NO TOOLS)
Bullet list of fast visual / audible / sensory checks a tech can do in under a minute.

4. STEP-BY-STEP RESOLUTION
Numbered, one action per step, imperative verbs, practical execution only.

End with exactly this paragraph:
"Did this fix the issue? If not, provide:
- PLC input/output status
- Voltage readings
- Any fault codes

Then refine the diagnosis further."

If the issue description is missing critical data, still produce the full
structure but call out targeted clarifying questions inside the relevant
section (e.g. "Is the motor humming or completely dead?").
```

---

## 4. Edge function — `supabase/functions/diagnose/index.ts`

```ts
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SYSTEM_PROMPT = `... (paste the system prompt from section 3) ...`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'x-session-id',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });

  const { issue, equipmentId } = await req.json();
  if (!issue || typeof issue !== 'string') {
    return new Response(JSON.stringify({ error: 'issue required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Identify the user from the JWT so we can attach sessions to them
  const authHeader = req.headers.get('Authorization') || '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  const userId = userData?.user?.id ?? null;

  // Create session row up front so we have an id to return in the header
  const { data: session } = await supabase
    .from('diagnostic_sessions')
    .insert({ user_id: userId, equipment_id: equipmentId ?? null, issue, response: '' })
    .select()
    .single();

  // Call OpenAI with streaming
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      stream: true,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Equipment: ${equipmentId ?? 'unspecified'}\nIssue: ${issue}` },
      ],
    }),
  });

  if (!openaiRes.ok || !openaiRes.body) {
    const msg = await openaiRes.text().catch(() => 'upstream error');
    return new Response(msg, { status: 502, headers: CORS });
  }

  // Proxy the SSE stream straight to the client AND accumulate full text
  // so we can save it to the session row when the stream completes.
  let full = '';
  const reader = openaiRes.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Extract token text for persistence
          for (const line of chunk.split('\n')) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const json = JSON.parse(payload);
              const tok = json.choices?.[0]?.delta?.content ?? '';
              if (tok) full += tok;
            } catch { /* ignore */ }
          }
          controller.enqueue(encoder.encode(chunk));
        }
      } finally {
        controller.close();
        // Persist the full response
        if (session?.id) {
          await supabase
            .from('diagnostic_sessions')
            .update({ response: full })
            .eq('id', session.id);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'x-session-id': session?.id ?? '',
    },
  });
});
```

Deploy:

```bash
supabase functions deploy diagnose --no-verify-jwt
supabase secrets set OPENAI_API_KEY=sk-...
```

---

## 5. Anthropic (Claude) variant

Replace the OpenAI `fetch` call with:

```ts
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-3-5-sonnet-latest',
    max_tokens: 1200,
    stream: true,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Equipment: ${equipmentId ?? 'unspecified'}\nIssue: ${issue}` }],
  }),
});
```

The frontend stream parser in `src/lib/diagnosticStream.ts` already handles
both OpenAI (`choices[0].delta.content`) and Anthropic (`delta.text`) SSE
payloads.
