import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('='))
    .map(([k, ...v]) => [k, v.join('=')]),
);

const anon = env.VITE_SUPABASE_ANON_KEY;
const url = `${env.VITE_SUPABASE_URL}/functions/v1/diagnose`;

function parseStreamChunk(chunk) {
  if (!chunk.includes('data:')) return chunk.includes('event:') ? '' : chunk;
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

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${anon}`,
    apikey: anon,
  },
  body: JSON.stringify({ issue: 'Conveyor wont start after sanitation' }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let full = '';
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value, { stream: true });
  full += parseStreamChunk(chunk);
}

console.log('STATUS', res.status);
console.log('FULL_LEN', full.length);
console.log('PREVIEW\n', full.slice(0, 800));