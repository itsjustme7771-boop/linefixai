import React, { useState, useMemo } from 'react';
import { ThumbsUp, Clock, MapPin, Tag, Search, FileUp, Building2, Zap, ShieldCheck, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { useCrossFixCards } from '@/hooks/useCrossFixCards';
import { useAppContext } from '@/contexts/AppContext';
import { hasSupabase } from '@/lib/supabase';

const CrossFixCards: React.FC = () => {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('approved');
  const { cards, live, approve, upvote } = useCrossFixCards();
  const { role, userName } = useAppContext();
  const canApprove = role === 'lead' || role === 'management';

  const filtered = useMemo(() => {
    return cards.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${c.title} ${c.equipment_name ?? ''} ${(c.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [cards, q, statusFilter]);

  const pendingCount = cards.filter(c => c.status === 'pending').length;

  return (
    <section id="crossfix" className="py-20 bg-[#0b1220]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-10">
          <div>
            <div className="text-[#00d4ff] text-xs font-mono uppercase tracking-widest mb-3">03 — Cross-Fix Network</div>
            <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight">Knowledge that moves at the speed of your line.</h2>
            <p className="mt-2 text-slate-400 max-w-2xl">Every approved fix syncs to every plant in real time via database Realtime. A tech in Texas solves it at 2am, a lead in Ohio uses it at 6am.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => toast('Lead/Management only — upload PDFs, manuals, schematics')} className="border-white/20 text-white bg-white/5 hover:bg-white/10">
              <FileUp className="w-4 h-4 mr-2" /> Upload Manual
            </Button>
          </div>
        </div>

        {/* Live sync banner */}
        <div className="mb-6 bg-gradient-to-r from-[#00d4ff]/10 to-transparent border border-[#00d4ff]/20 rounded-lg p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#00d4ff]/20 flex items-center justify-center shrink-0">
            {live ? <Wifi className="w-4 h-4 text-[#00d4ff]" /> : <Zap className="w-4 h-4 text-[#00d4ff]" />}
          </div>
          <div className="flex-1">
            <div className="text-sm text-white font-semibold">
              {live ? 'Realtime channel live — cards sync instantly across all plants' : hasSupabase ? 'Connecting to realtime channel…' : 'Demo mode — configure Supabase for live cross-plant sync'}
            </div>
            <div className="text-xs text-slate-400 font-mono">{cards.length} cards in network · {pendingCount} pending approval</div>
          </div>
          <span className={`w-2 h-2 rounded-full shrink-0 ${live ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
        </div>

        <div className="grid md:grid-cols-[1fr_auto] gap-3 mb-6">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search fixes: e.g. 'post-sanitation', 'F007', 'photo-eye'..."
              className="w-full bg-[#111c2e] border border-white/10 rounded-md pl-9 pr-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#00d4ff]"
            />
          </div>
          <div className="flex gap-1 bg-[#111c2e] border border-white/10 rounded-md p-1">
            {(['approved', 'pending', 'all'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-mono uppercase rounded transition-colors ${
                  statusFilter === s ? 'bg-[#ff6b35] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}{s === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 text-sm font-mono">
              No cards match. Run a diagnostic and save it as a Cross-Fix Card to seed the network.
            </div>
          )}
          {filtered.map(c => (
            <div key={c.id} className="bg-[#111c2e] border border-white/10 rounded-lg overflow-hidden hover:border-[#ff6b35]/40 transition-colors flex flex-col">
              <div className="bg-gradient-to-r from-[#ff6b35]/10 to-transparent px-4 py-2 border-b border-white/5 flex justify-between items-center">
                <span className="text-[10px] font-mono text-[#ff6b35] uppercase tracking-wider">{c.code || c.id.slice(0, 8)}</span>
                <div className="flex items-center gap-2">
                  {c.status === 'pending' && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">PENDING</span>
                  )}
                  {c.status === 'approved' && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">APPROVED</span>
                  )}
                  <span className="text-[10px] font-mono text-slate-500">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col">
                <h3 className="text-white font-bold text-sm leading-snug mb-3">{c.title}</h3>
                <div className="space-y-2 text-xs mb-3">
                  {c.equipment_name && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Building2 className="w-3 h-3 text-[#00d4ff]" />
                      <span>{c.equipment_name}{c.equipment_id ? ` (${c.equipment_id})` : ''}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-400">
                    <MapPin className="w-3 h-3 text-[#00d4ff]" />
                    <span>{c.plant || '—'} · {c.author || 'Unknown'}{c.author_role ? ` (${c.author_role})` : ''}</span>
                  </div>
                  {c.time_to_fix && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Clock className="w-3 h-3 text-[#00d4ff]" />
                      <span>Time to fix: <span className="text-white font-semibold">{c.time_to_fix}</span></span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-xs border-t border-white/5 pt-3 flex-1">
                  {c.symptoms && (<div><div className="text-[10px] font-mono uppercase text-amber-400 tracking-wider mb-0.5">Symptoms</div><p className="text-slate-300">{c.symptoms}</p></div>)}
                  {c.root_cause && (<div><div className="text-[10px] font-mono uppercase text-amber-400 tracking-wider mb-0.5">Root Cause</div><p className="text-slate-300">{c.root_cause}</p></div>)}
                  {c.solution && (<div><div className="text-[10px] font-mono uppercase text-emerald-400 tracking-wider mb-0.5">Solution</div><p className="text-slate-300">{c.solution}</p></div>)}
                </div>

                {(c.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {c.tags.map(t => (
                      <span key={t} className="text-[10px] bg-white/5 text-slate-400 px-2 py-0.5 rounded flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5" />{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 px-4 py-2 flex justify-between items-center">
                <button onClick={() => upvote(c.id)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#00d4ff] transition-colors">
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span className="font-semibold">{c.helpful}</span>
                  <span>helpful</span>
                </button>
                {c.status === 'pending' && canApprove ? (
                  <button
                    onClick={async () => { await approve(c.id, userName); toast.success('Card approved & synced to all plants'); }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> Approve
                  </button>
                ) : (
                  <button onClick={() => toast.success('Card applied to active diagnostic')} className="text-xs text-[#ff6b35] hover:text-[#ff8555] font-semibold">
                    Apply →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CrossFixCards;
