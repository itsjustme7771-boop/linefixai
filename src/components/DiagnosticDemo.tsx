import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, Send, CheckCircle2, Circle, Zap, History, Server, Sparkles,
  StopCircle, Loader2, QrCode, X, BookmarkPlus, Filter,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { streamDiagnosis } from '@/lib/diagnosticStream';
import { parseDiagnosis } from '@/lib/diagnosticParser';
import { hasSupabase } from '@/lib/supabase';
import { useDiagnosticSessions, type DiagnosticSession } from '@/hooks/useDiagnosticSessions';
import { useAppContext } from '@/contexts/AppContext';
import SaveCrossFixCardModal from './SaveCrossFixCardModal';

const presets = [
  "Conveyor won't start after sanitation — no fault code",
  'VFD showing F007 Ground Fault on M-01',
  'Photo-eye ghost-triggering on packaging line',
  'Robotic arm stuck at home position, ER-214',
];

const DiagnosticDemo: React.FC = () => {
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [rawText, setRawText] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [steps, setSteps] = useState<Record<number, boolean>>({});
  const [source, setSource] = useState<'llm' | 'mock' | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFilterMachine, setHistoryFilterMachine] = useState(false);
  const [saveCardOpen, setSaveCardOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  const { activeEquipment, setActiveEquipment } = useAppContext();
  const { sessions, save, updateOutcome } = useDiagnosticSessions();
  const parsed = useMemo(() => (rawText ? parseDiagnosis(rawText) : null), [rawText]);

  useEffect(() => {
    if (streaming && outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [rawText, streaming]);

  const run = async (q?: string) => {
    const query = (q || input).trim();
    if (!query) { toast.error('Describe the issue first'); return; }
    setInput(query);
    setRawText(''); setChecks({}); setSteps({});
    setStreaming(true); setSource(null); setCurrentSessionId(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const result = await streamDiagnosis({
        issue: query,
        equipmentId: activeEquipment?.id,
        onToken: (_t, full) => setRawText(full),
        signal: ctrl.signal,
      });
      setSource(result.source);
      const saved = await save({
        issue: query,
        response: result.fullText,
        id: result.sessionId,
        equipment_id: activeEquipment?.id ?? null,
      });
      setCurrentSessionId(saved.id);
      toast.success(
        result.source === 'llm'
          ? `AI diagnosis complete${activeEquipment ? ` for ${activeEquipment.id}` : ''} — session saved`
          : 'Demo mode — configure Supabase for live AI',
      );
    } catch (err: any) {
      if (err?.name === 'AbortError') toast('Stream stopped');
      else { console.error(err); toast.error(err?.message || 'Diagnostic failed'); }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const loadSession = (s: DiagnosticSession) => {
    setInput(s.issue);
    setRawText(s.response);
    setCurrentSessionId(s.id);
    setSource('llm');
    setHistoryOpen(false);
    setTimeout(() => { document.getElementById('diagnostic')?.scrollIntoView({ behavior: 'smooth' }); }, 50);
  };

  const markOutcome = async (outcome: 'fixed' | 'refine') => {
    if (!currentSessionId) {
      toast(outcome === 'fixed' ? 'Logged locally' : 'Refining — provide PLC I/O, voltage, fault codes');
      return;
    }
    await updateOutcome(currentSessionId, outcome);
    toast.success(outcome === 'fixed' ? 'Marked as fixed — save as Cross-Fix Card to share' : 'Marked for refinement');
  };

  const filteredSessions = useMemo(() => {
    if (!historyFilterMachine || !activeEquipment) return sessions;
    return sessions.filter(s => s.equipment_id === activeEquipment.id);
  }, [sessions, historyFilterMachine, activeEquipment]);

  const cardPrefill = useMemo(() => {
    const rc = parsed?.causes?.[0];
    return {
      title: input.slice(0, 80) || 'New Cross-Fix Card',
      symptoms: input,
      rootCause: rc ? `${rc.label}${rc.detail ? ' — ' + rc.detail : ''}` : '',
      solution: (parsed?.steps || []).join('\n'),
      parts: [],
      timeToFix: '',
      tags: activeEquipment?.type ? [activeEquipment.type.toLowerCase()] : [],
      equipmentId: activeEquipment?.id ?? null,
      equipmentName: activeEquipment?.name ?? null,
      plant: activeEquipment?.location?.split(' - ')[0] ?? null,
      sessionId: currentSessionId,
    };
  }, [parsed, input, activeEquipment, currentSessionId]);

  return (
    <section id="diagnostic" className="py-20 bg-[#0b1220]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-10">
          <div className="max-w-3xl">
            <div className="text-[#00d4ff] text-xs font-mono uppercase tracking-widest mb-3">01 — Diagnostic Engine</div>
            <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight">Describe the fault. Get a technician-grade fix in seconds.</h2>
            <p className="mt-3 text-slate-400">Scan an equipment QR to inject structured asset context + uploaded manuals into the AI prompt. Every session is saved and tagged to the machine.</p>
          </div>
          <div className="flex items-center gap-2">
            <BackendBadge />
            <Button variant="outline" onClick={() => setHistoryOpen(v => !v)} className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
              <History className="w-4 h-4 mr-2" />
              History <span className="ml-2 text-xs text-slate-400">({sessions.length})</span>
            </Button>
          </div>
        </div>

        {historyOpen && (
          <div className="mb-6 bg-[#111c2e] border border-white/10 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-mono uppercase tracking-widest text-[#00d4ff]">Recent Sessions</div>
              {activeEquipment && (
                <button
                  onClick={() => setHistoryFilterMachine(v => !v)}
                  className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
                    historyFilterMachine ? 'bg-[#ff6b35]/20 border-[#ff6b35]/40 text-[#ff6b35]' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  Fixes for {activeEquipment.id}
                </button>
              )}
            </div>
            {filteredSessions.length === 0 && (
              <p className="text-sm text-slate-500">
                {historyFilterMachine ? `No prior sessions for ${activeEquipment?.id}.` : 'No sessions yet.'}
              </p>
            )}
            <div className="grid md:grid-cols-2 gap-2 max-h-80 overflow-auto pr-1">
              {filteredSessions.map(s => (
                <button key={s.id} onClick={() => loadSession(s)} className="text-left bg-white/5 hover:bg-white/10 border border-white/5 rounded-md p-3 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-slate-500">{new Date(s.created_at).toLocaleString()}</span>
                    <div className="flex items-center gap-1">
                      {s.equipment_id && (<span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#00d4ff]/15 text-[#00d4ff]">{s.equipment_id}</span>)}
                      {s.outcome === 'fixed' && (<span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">FIXED</span>)}
                      {s.outcome === 'refine' && (<span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">REFINE</span>)}
                    </div>
                  </div>
                  <div className="text-sm text-slate-200 mt-1 line-clamp-2">{s.issue}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-[#111c2e] border border-white/10 rounded-xl p-6 h-fit">
            {/* Active Equipment chip */}
            {activeEquipment ? (
              <div className="mb-4 bg-gradient-to-r from-[#00d4ff]/15 to-transparent border border-[#00d4ff]/30 rounded-lg p-3 flex items-center gap-3">
                {activeEquipment.image && (
                  <img src={activeEquipment.image} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#00d4ff] uppercase tracking-wider">Active Equipment</span>
                    <span className="text-[10px] font-mono text-slate-500">{activeEquipment.id}</span>
                  </div>
                  <div className="text-sm text-white font-semibold truncate">{activeEquipment.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">{activeEquipment.location} · serviced {activeEquipment.lastService}</div>
                </div>
                <button
                  onClick={() => setActiveEquipment(null)}
                  title="Clear active equipment"
                  className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="mb-4 border border-dashed border-white/10 rounded-lg p-3 flex items-center gap-2 text-xs text-slate-500">
                <QrCode className="w-4 h-4 text-slate-600" />
                <span>No equipment scanned — AI will run without asset context.</span>
              </div>
            )}

            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Issue Description</label>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="e.g. Conveyor A-12 dead on Monday startup, no HMI fault..."
              disabled={streaming}
              className="mt-2 w-full h-32 bg-[#0b1220] border border-white/10 rounded-md p-3 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-[#00d4ff] disabled:opacity-60"
            />
            {streaming ? (
              <Button onClick={stop} className="mt-3 w-full bg-white/10 hover:bg-white/15 text-white font-semibold">
                <StopCircle className="w-4 h-4 mr-2" /> Stop Streaming
              </Button>
            ) : (
              <Button onClick={() => run()} className="mt-3 w-full bg-[#ff6b35] hover:bg-[#ff8555] text-white font-semibold">
                <Send className="w-4 h-4 mr-2" /> Run AI Diagnostic{activeEquipment ? ` on ${activeEquipment.id}` : ''}
              </Button>
            )}

            <div className="mt-5 pt-5 border-t border-white/10">
              <div className="text-xs text-slate-400 uppercase font-mono tracking-wider mb-2">Quick-load examples</div>
              <div className="space-y-2">
                {presets.map(p => (
                  <button key={p} onClick={() => run(p)} disabled={streaming} className="w-full text-left text-xs text-slate-300 bg-white/5 hover:bg-white/10 border border-white/5 rounded-md px-3 py-2 transition-colors disabled:opacity-50">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {!parsed && !streaming && (
              <div className="h-full min-h-[500px] border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-center p-8">
                <div>
                  <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 font-mono text-sm">Diagnostic output will appear here</p>
                  <p className="text-slate-600 font-mono text-[10px] mt-2">
                    {hasSupabase ? 'Connected to live AI backend' : 'Running in demo mode'}
                  </p>
                </div>
              </div>
            )}

            {(parsed || streaming) && (
              <div ref={outputRef} className="bg-[#111c2e] border border-white/10 rounded-xl overflow-hidden max-h-[720px] overflow-y-auto">
                <div className="bg-[#0b1220] px-4 py-2 border-b border-white/10 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 text-slate-400">
                    {streaming ? (<><Loader2 className="w-3.5 h-3.5 animate-spin text-[#00d4ff]" /><span className="text-[#00d4ff]">STREAMING...</span></>)
                      : (<><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">COMPLETE</span></>)}
                    {activeEquipment && (<span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#00d4ff]/15 text-[#00d4ff]">{activeEquipment.id}</span>)}
                  </div>
                  <div className="text-slate-500">{rawText.length} chars</div>
                </div>

                <div className="bg-gradient-to-r from-[#ff6b35] to-[#ff8555] px-5 py-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-white" />
                  <span className="font-bold text-white uppercase tracking-wider text-sm">1. Safety First</span>
                </div>
                <div className="p-5 border-b border-white/10">
                  {parsed && parsed.safety.length > 0 ? (
                    <ul className="text-sm text-slate-200 space-y-1.5">
                      {parsed.safety.map((line, i) => (
                        <li key={i} className="flex gap-2"><span className="text-[#ff6b35] shrink-0">■</span><span>{line}</span></li>
                      ))}
                    </ul>
                  ) : (<SkeletonLines n={4} />)}
                </div>

                <div className="px-5 py-4 border-b border-white/10">
                  <div className="text-xs font-mono uppercase tracking-widest text-[#00d4ff] mb-3">2. Top 3 Probable Causes</div>
                  {parsed && parsed.causes.length > 0 ? parsed.causes.map(c => (
                    <div key={c.rank} className="flex gap-3 py-2">
                      <div className="w-7 h-7 rounded-full bg-[#ff6b35] text-white font-bold flex items-center justify-center text-sm shrink-0">{c.rank}</div>
                      <div>
                        <div className="text-white font-semibold text-sm">{c.label}</div>
                        {c.detail && <div className="text-slate-400 text-xs mt-0.5">{c.detail}</div>}
                      </div>
                    </div>
                  )) : (<SkeletonLines n={3} />)}
                </div>

                <div className="px-5 py-4 border-b border-white/10">
                  <div className="text-xs font-mono uppercase tracking-widest text-[#00d4ff] mb-3">3. 60-Second Check — No Tools</div>
                  {parsed && parsed.checks.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {parsed.checks.map((label, i) => (
                        <button key={i} onClick={() => setChecks({ ...checks, [label]: !checks[label] })}
                          className={`flex items-start gap-2 text-left text-xs px-3 py-2 rounded border transition-colors ${
                            checks[label] ? 'bg-[#00d4ff]/10 border-[#00d4ff]/40 text-white' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                          }`}>
                          {checks[label] ? <CheckCircle2 className="w-4 h-4 text-[#00d4ff] shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 shrink-0 mt-0.5" />}
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  ) : (<SkeletonLines n={3} />)}
                </div>

                <div className="px-5 py-4">
                  <div className="text-xs font-mono uppercase tracking-widest text-[#00d4ff] mb-3">4. Step-by-Step Resolution</div>
                  {parsed && parsed.steps.length > 0 ? (
                    <ol className="space-y-1">
                      {parsed.steps.map((s, i) => (
                        <li key={i}>
                          <button onClick={() => setSteps({ ...steps, [i]: !steps[i] })} className="w-full flex items-start gap-3 text-left p-2 rounded hover:bg-white/5 transition-colors">
                            <span className={`w-6 h-6 rounded shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${steps[i] ? 'bg-[#00d4ff] text-[#0b1220]' : 'bg-white/10 text-slate-300'}`}>
                              {steps[i] ? '✓' : i + 1}
                            </span>
                            <span className={`text-sm ${steps[i] ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{s}</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : (<SkeletonLines n={5} />)}
                </div>

                {!streaming && parsed && (
                  <div className="bg-[#0b1220] px-5 py-4 border-t border-white/10">
                    <div className="text-sm text-slate-300 mb-2 font-semibold">Did this fix the issue?</div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => markOutcome('fixed')} className="bg-[#00d4ff] text-[#0b1220] hover:bg-[#33ddff] font-semibold">Yes — Fixed</Button>
                      <Button size="sm" variant="outline" onClick={() => markOutcome('refine')} className="border-white/20 text-slate-200 hover:bg-white/5">No — Refine</Button>
                      <Button size="sm" onClick={() => setSaveCardOpen(true)} className="bg-[#ff6b35] hover:bg-[#ff8555] text-white font-semibold">
                        <BookmarkPlus className="w-3.5 h-3.5 mr-1.5" /> Save as Cross-Fix Card
                      </Button>
                      {source && (<span className="ml-auto text-[10px] font-mono text-slate-500 self-center">{source === 'llm' ? 'LLM · session saved' : 'MOCK · demo mode'}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <SaveCrossFixCardModal open={saveCardOpen} onClose={() => setSaveCardOpen(false)} prefill={cardPrefill} />
    </section>
  );
};

const SkeletonLines: React.FC<{ n: number }> = ({ n }) => (
  <div className="space-y-2">
    {Array.from({ length: n }).map((_, i) => (
      <div key={i} className="h-3 bg-white/5 rounded animate-pulse" style={{ width: `${60 + ((i * 13) % 35)}%` }} />
    ))}
  </div>
);

const BackendBadge: React.FC = () => (
  <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] font-mono uppercase tracking-wider ${
    hasSupabase ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
  }`} title={hasSupabase ? 'Live AI backend connected' : 'Demo mode'}>
    {hasSupabase ? <Server className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
    {hasSupabase ? 'Live AI' : 'Demo Mode'}
  </div>
);

export default DiagnosticDemo;
