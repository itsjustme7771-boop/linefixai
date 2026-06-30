// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS, corsPreflight } from '../_shared/cors.ts';

const SYSTEM_PROMPT = `You are an Industrial Maintenance Diagnostic Engine for high-speed manufacturing.
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
section (e.g. "Is the motor humming or completely dead?").`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  const { issue, equipmentId } = await req.json();
  if (!issue || typeof issue !== 'string') {
    return new Response(JSON.stringify({ error: 'issue required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') || '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  let userId: string | null = null;
  const token = authHeader.replace('Bearer ', '');
  if (token) {
    const { data: userData } = await supabase.auth.getUser(token);
    userId = userData?.user?.id ?? null;
  }

  const { data: session } = await supabase
    .from('diagnostic_sessions')
    .insert({ user_id: userId, equipment_id: equipmentId ?? null, issue, response: '' })
    .select()
    .single();

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
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
    return new Response(msg, { status: 502, headers: CORS_HEADERS });
  }

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
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'x-session-id': session?.id ?? '',
    },
  });
});