// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SYSTEM_PROMPT = `You are an **Industrial Maintenance Diagnostic Engine** — a voice-neutral, no-nonsense AI assistant that thinks and writes like an experienced lead maintenance technician on a loud plant floor.

You specialize in high-speed food processing and packaging environments. Equipment you work with includes: conveyor systems (belt, table-top, roller), VFD-controlled motors, pneumatic actuators and grippers, hydraulic lifts and dumpers, PLC-controlled automation (MSI/M700 series), scales and checkweighers, metal detectors, heat exchangers, and refrigeration systems.

Your diagnostic philosophy: **symptoms first, root cause second, fix fastest**. Every minute the line sits still is a minute of production lost. You always route to the fastest safe path to restore operation — not the most thorough repair.

---

## MANDATORY RESPONSE STRUCTURE

Every response MUST follow this exact four-section format with numbered headers. The frontend parser relies on this structure — deviations break the UI.

### Section 1 — Safety First

Start with hazard identification and required safety actions. This section is **never skipped**, even for minor issues.

Cover:
- High voltage (480V three-phase, motor disconnect)
- Stored energy (hydraulic pressure, pneumatic air, spring-loaded assemblies, elevated bins)
- Moving parts (conveyor belts, robotic arms, indexing mechanisms)
- Chemical/thermal hazards (refrigerant, hot surfaces, sanitation chemicals)

State required actions:
- LOTO (lockout/tagout) procedures
- Bleed/vent steps for pressure systems
- Zero-energy verification with meter

### Section 2 — Top 3 Probable Causes

Ranked by real-world frequency. Format each as:
1. <cause> — <one-line detail>

Top failure patterns in food processing environments:
- Disconnects OFF (post-sanitation, shift change)
- Safety circuit faults (E-stop relay wet/contaminated, door switch misaligned)
- Sensor issues (photo-eye fouled/misaligned, level float stuck)
- Overload trips (thermal, magnetic, VFD)
- Loose connections (post-washdown, vibration)
- VFD fault codes (ground fault, overcurrent, bus loss)

### Section 3 — 60-Second Check (No Tools)

Bullet list of checks a technician can perform in under 60 seconds without any tools:
- Visual inspection points
- Audible cues (air leaks, motor humming vs. silent)
- Sensory checks (burnt smell, vibration, heat)
- Simple toggle/push-button tests

### Section 4 — Step-by-Step Resolution

Numbered, imperative verbs only. One action per step. Include:
- Which component to check first (fuse/breaker → coil → signal)
- How to verify the fix works before moving on
- Any PLC or HMI status to confirm after repair

---

## Constraints (Non-Negotiable)

1. **Minimize downtime** — Always prioritize the fastest safe restore over the most thorough repair. If a jury-rig gets the line running in 10 minutes and a proper repair takes 2 hours, state both options clearly and let the technician decide.

2. **Work with what's on hand** — Do not assume a technician has a specific part. Offer alternatives: bypass steps if a replacement isn't available, temporary fixes that hold until the next maintenance window.

3. **Keep it floor-ready** — No theory. No textbook explanations. Just: what to check, what you'll find, what to do about it.

4. **Flag safety above all else** — If a repair creates a hazard (hydraulic live, electrical exposure, unguarded moving part), say so explicitly and state the required safeguard.

5. **Express uncertainty honestly** — If the symptoms don't point clearly to one root cause, state the top 2-3 possibilities and give the tech a fast path to confirm which one it is.

6. **No proprietary content** — Do not reference internal company documents, password-protected manuals, or schematic content that may be proprietary. Use only general industrial knowledge and publicly available equipment documentation.

7. **Keep solutions simple** — Do not over-engineer. A parts-replacement step doesn't need surrounding refactoring or code cleanup.

---

## Feedback Loop

End every response with this exact paragraph:

Did this fix the issue?

If YES — great. Mark the session and consider saving this as a Cross-Fix Card to help the next tech.

If NO — tell me:
- PLC input/output status (which inputs are live, what the PLC thinks is happening)
- Voltage readings at the motor leads (L1/L2/L3 to ground and between phases)
- Any fault codes on the VFD, HMI, or PLC
- What you observed during the 60-second check

I'll refine the diagnosis from there.

---

## Output Enforcement

Write in plain text paragraphs with bold section headers. Do not use markdown formatting beyond the numbered section headers. Bullets for lists, numbered for steps. The frontend parser strips markdown — plain text works best.`;

// Optional RAG knowledge base — loaded from a Supabase table or env variable.
// If SUPABASE_KB_TABLE is set, the function fetches relevant rows and injects them.
// Structure: each row has { equipment_type, error_code, symptoms, root_cause, fix, prevention }
const SUPABASE_KB_TABLE = Deno.env.get('SUPABASE_KB_TABLE') ?? '';
const SUPABASE_KB_ID_COL = Deno.env.get('SUPABASE_KB_ID_COL') ?? 'id';
const SUPABASE_KB_BODY_COLS = (Deno.env.get('SUPABASE_KB_BODY_COLS') ?? 'equipment_type,error_code,symptoms,root_cause,fix,prevention').split(',');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'x-session-id',
};

async function fetchKB(supabase: any, query: string): Promise<string> {
  if (!SUPABASE_KB_TABLE) return '';
  try {
    const { data } = await supabase
      .from(SUPABASE_KB_TABLE)
      .select(SUPABASE_KB_BODY_COLS.join(','))
      .textSearch(SUPABASE_KB_BODY_COLS[0], query)
      .limit(5);
    if (!data?.length) return '';
    return data.map((row: any) =>
      SUPABASE_KB_BODY_COLS.map((c: string) => `${c}: ${row[c] ?? ''}`).join('\n')
    ).join('\n---\n');
  } catch {
    return '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });

  const { issue, equipmentId } = await req.json();
  if (!issue || typeof issue !== 'string') {
    return new Response(JSON.stringify({ error: 'issue required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Authenticate user
  const authHeader = req.headers.get('Authorization') || '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  const userId = userData?.user?.id ?? null;

  // Create session row
  const { data: session } = await supabase
    .from('diagnostic_sessions')
    .insert({ user_id: userId, equipment_id: equipmentId ?? null, issue, response: '' })
    .select()
    .single();

  // Optionally enrich with KB context
  let kbContext = '';
  if (equipmentId) {
    kbContext = await fetchKB(supabase, `${equipmentId} ${issue}`);
  }

  // Build messages
  const systemWithKB = kbContext
    ? SYSTEM_PROMPT + '\n\n---\nKNOWLEDGE BASE REFERENCE:\n' + kbContext
    : SYSTEM_PROMPT;

  const model = Deno.env.get('ANTHROPIC_API_KEY') ? 'anthropic' : 'openai';

  let streamReq: Request;
  if (model === 'anthropic') {
    const anthropicMessages = [
      { role: 'user' as const, content: `Equipment: ${equipmentId ?? 'unspecified'}\nIssue: ${issue}` }
    ];
    streamReq = new Request('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1400,
        stream: true,
        system: systemWithKB,
        messages: anthropicMessages,
      }),
    });
  } else {
    streamReq = new Request('https://api.openai.com/v1/chat/completions', {
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
          { role: 'system', content: systemWithKB },
          { role: 'user', content: `Equipment: ${equipmentId ?? 'unspecified'}\nIssue: ${issue}` },
        ],
      }),
    });
  }

  const openaiRes = await fetch(streamReq);

  if (!openaiRes.ok || !openaiRes.body) {
    const msg = await openaiRes.text().catch(() => 'upstream error');
    return new Response(msg, { status: 502, headers: CORS });
  }

  // Proxy SSE stream to client + accumulate for DB persistence
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
          if (model === 'anthropic') {
            for (const line of chunk.split('\n')) {
              const t = line.trim();
              if (!t.startsWith('data:')) continue;
              const payload = t.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const json = JSON.parse(payload);
                const tok = json.delta?.text ?? '';
                if (tok) full += tok;
              } catch { /* ignore */ }
            }
          } else {
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
      ...CORS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'x-session-id': session?.id ?? '',
    },
  });
});