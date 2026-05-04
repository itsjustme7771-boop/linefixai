import { DIAGNOSE_FN_URL, hasSupabase, SUPABASE_ANON } from './supabase';

// Fallback mock response used when no edge function is configured. Matches the
// strict response format so the UI parser works identically in both paths.
const MOCK_RESPONSE = `1. SAFETY FIRST
- Apply LOTO at the main disconnect and verify zero energy with a meter.
- Bleed air pressure at the FRL before disconnecting any pneumatic lines.
- Watch for stored mechanical energy on spring-loaded assemblies.
- Confirm 480V de-energized on L1/L2/L3 before touching terminals.

2. TOP 3 PROBABLE CAUSES
1. End-of-line disconnect OFF — sanitation crew often kills power for washdown and there's no SOP to restore it.
2. Safety interlock not made up — E-stop relay wet from washdown or guard door switch dislodged.
3. Photo-eye sensor misaligned or fouled — vibration plus product dust, check the alignment LED.

3. 60-SECOND CHECK (NO TOOLS)
- Disconnect switch at the machine in the ON position?
- Any loose or pulled wires at the junction box?
- Product jam visible anywhere on the belt?
- Motor humming when start is pressed?
- Audible air leaks around solenoid stack?
- Burnt smell near the control panel?

4. STEP-BY-STEP RESOLUTION
1. Verify end-of-line disconnect is ON. Check for lockout tag first.
2. Confirm 480V at L1, L2, and L3 on the main disconnect.
3. Reset any tripped overloads in the MCC.
4. Inspect and realign the photo-eye sensor using the alignment LED.
5. Verify the PLC input light for the sensor signal is ON.
6. Restart the line and monitor for 2 full cycles.

Did this fix the issue? If not, provide:
- PLC input/output status
- Voltage readings at L1/L2/L3
- Any fault codes on the VFD or HMI

Then I'll refine the diagnosis further.`;

export interface StreamOptions {
  issue: string;
  equipmentId?: string;
  onToken: (chunk: string, full: string) => void;
  signal?: AbortSignal;
}

export interface StreamResult {
  fullText: string;
  sessionId?: string;
  source: 'llm' | 'mock';
}

/**
 * Streams a diagnostic response. Prefers the Supabase edge function when
 * configured; otherwise streams a realistic mock token-by-token so the UI
 * behaves identically in development.
 */
export async function streamDiagnosis(opts: StreamOptions): Promise<StreamResult> {
  if (hasSupabase && DIAGNOSE_FN_URL) {
    return streamFromEdge(opts);
  }
  return streamMock(opts);
}

async function streamFromEdge(opts: StreamOptions): Promise<StreamResult> {
  const { issue, equipmentId, onToken, signal } = opts;
  const anon = SUPABASE_ANON;

  const res = await fetch(DIAGNOSE_FN_URL as string, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anon}`,
      apikey: anon,
    },
    body: JSON.stringify({ issue, equipmentId }),
  });

  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Diagnose function failed: ${msg || res.status}`);
  }

  const sessionId = res.headers.get('x-session-id') || undefined;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    // Support both raw text streams and SSE-style "data: ..." frames
    const parsed = parseStreamChunk(chunk);
    if (parsed) {
      full += parsed;
      opts.onToken(parsed, full);
    }
  }

  return { fullText: full, sessionId, source: 'llm' };
}

function parseStreamChunk(chunk: string): string {
  if (!chunk.includes('data:')) return chunk;
  let out = '';
  for (const line of chunk.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const json = JSON.parse(payload);
      const tok =
        json.choices?.[0]?.delta?.content ??
        json.delta?.text ??
        json.content ??
        json.token ??
        '';
      if (tok) out += tok;
    } catch {
      out += payload;
    }
  }
  return out;
}

async function streamMock(opts: StreamOptions): Promise<StreamResult> {
  const text = MOCK_RESPONSE;
  let full = '';
  // Token-ish chunks (word + space) with small delays
  const tokens = text.match(/\S+\s*|\n/g) || [text];
  for (const tok of tokens) {
    if (opts.signal?.aborted) break;
    full += tok;
    opts.onToken(tok, full);
    await new Promise(r => setTimeout(r, 18));
  }
  return { fullText: full, source: 'mock' };
}
