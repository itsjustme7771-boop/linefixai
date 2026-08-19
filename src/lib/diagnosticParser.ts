// Parses the strict LLM response format into structured sections the UI can render
// as they stream in. Works on partial text so we can progressively reveal sections.

export interface ParsedDiagnosis {
  safety: string[];
  causes: { rank: number; label: string; detail: string }[];
  checks: string[];
  steps: string[];
  feedback: string;
  raw: string;
}

const SECTION_HEADERS = [
  { key: 'safety', re: /^[ \t]*(?:#{1,6}[ \t]*)?(?:1[.)]?[ \t]*)?SAFETY FIRST[ \t]*$/im },
  { key: 'causes', re: /^[ \t]*(?:#{1,6}[ \t]*)?(?:2[.)]?[ \t]*)?(?:MOST LIKELY CAUSES|TOP 3 PROBABLE CAUSES)[ \t]*$/im },
  { key: 'checks', re: /^[ \t]*(?:#{1,6}[ \t]*)?(?:3[.)]?[ \t]*)?(?:FAST CHECKS|60-?SECOND CHECK(?:[ \t]*\(NO TOOLS\)|[ \t]*[—-][ \t]*NO TOOLS)?)[ \t]*$/im },
  { key: 'steps', re: /^[ \t]*(?:#{1,6}[ \t]*)?(?:4[.)]?[ \t]*)?STEP-?BY-?STEP RESOLUTION[ \t]*$/im },
  { key: 'feedback', re: /^[ \t]*(?:#{1,6}[ \t]*)?(?:5[.)]?[ \t]*)?VERIFICATION[ \t]*$/im },
] as const;

function sliceSections(text: string): Record<string, string> {
  const indexes: { key: string; start: number }[] = [];
  for (const h of SECTION_HEADERS) {
    const m = text.match(h.re);
    if (m && m.index !== undefined) indexes.push({ key: h.key, start: m.index });
  }
  indexes.sort((a, b) => a.start - b.start);

  const result: Record<string, string> = {};
  for (let i = 0; i < indexes.length; i++) {
    const cur = indexes[i];
    const next = indexes[i + 1];
    const body = text.slice(cur.start, next ? next.start : text.length);
    // strip the header line
    const firstNewline = body.indexOf('\n');
    result[cur.key] = firstNewline >= 0 ? body.slice(firstNewline + 1) : '';
  }
  return result;
}

function cleanBullet(line: string): string {
  return line
    .replace(/^\s*[-*•■]\s*/, '')
    .replace(/^\s*\d+[.)]\s*/, '')
    .trim();
}

function linesOf(block: string | undefined): string[] {
  if (!block) return [];
  return block
    .split('\n')
    .map(l => cleanBullet(l))
    .filter(l => l.length > 0 && !/^-{3,}$/.test(l));
}

export function parseDiagnosis(raw: string): ParsedDiagnosis {
  const sections = sliceSections(raw);

  const safety = linesOf(sections.safety).filter(l => !/^(Identify|Clearly|Hazards|Required)/i.test(l)).slice(0, 8);
  const checks = linesOf(sections.checks).filter(l => !/^(Visual|Audible|Sensory):?$/i.test(l)).slice(0, 10);
  const steps = linesOf(sections.steps).slice(0, 12);
  const feedback = (sections.feedback || '').trim();

  // Causes: group rank + detail. The format is typically:
  //   1. Most likely cause — detail
  //   (Detail line under it)
  const causeLines = linesOf(sections.causes);
  const causes: ParsedDiagnosis['causes'] = [];
  let cur: { rank: number; label: string; detail: string } | null = null;
  const rankRe = /^(\d)\s*[.):-]\s*(.*)$/;
  for (const raw2 of (sections.causes || '').split('\n')) {
    const line = raw2.trim();
    if (!line) continue;
    const m = line.match(rankRe);
    if (m) {
      if (cur) causes.push(cur);
      const [, rank, rest] = m;
      const parts = rest.split(/\s[—–-]\s|:\s/);
      cur = {
        rank: Number(rank),
        label: (parts[0] || rest).trim(),
        detail: (parts.slice(1).join(' — ') || '').trim(),
      };
    } else if (cur) {
      const extra = cleanBullet(line);
      cur.detail = cur.detail ? `${cur.detail} ${extra}` : extra;
    }
  }
  if (cur) causes.push(cur);

  // Fallback: if we couldn't rank, just take the first 3 non-empty lines
  if (causes.length === 0) {
    causeLines.slice(0, 3).forEach((l, i) => causes.push({ rank: i + 1, label: l, detail: '' }));
  }

  return {
    safety,
    causes: causes.slice(0, 3),
    checks,
    steps,
    feedback,
    raw,
  };
}
