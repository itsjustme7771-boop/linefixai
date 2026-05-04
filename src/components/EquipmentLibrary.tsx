import React, { useState, useMemo } from 'react';
import { equipment } from '@/data/mockData';
import { Search, MapPin, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

const statusStyle = {
  operational: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  fault: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const EquipmentLibrary: React.FC<{ onScan: () => void }> = ({ onScan }) => {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'Conveyor' | 'Robotics'>('all');

  const list = useMemo(() => {
    return equipment.filter(e => {
      const matchQ = !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.id.toLowerCase().includes(q.toLowerCase()) || e.location.toLowerCase().includes(q.toLowerCase());
      const matchF = filter === 'all' || e.type === filter;
      return matchQ && matchF;
    });
  }, [q, filter]);

  return (
    <section id="equipment" className="py-20 bg-[#0f1824]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-10">
          <div>
            <div className="text-[#00d4ff] text-xs font-mono uppercase tracking-widest mb-3">02 — Equipment Library</div>
            <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight">Every machine. One QR tag away.</h2>
            <p className="mt-2 text-slate-400 max-w-2xl">Scan the tag on any asset to pull manuals, service history, and diagnostic flows tuned to that specific machine.</p>
          </div>
          <Button onClick={onScan} className="bg-[#00d4ff] text-[#0b1220] hover:bg-[#33ddff] font-semibold">
            <QrCode className="w-4 h-4 mr-2" /> Scan Equipment
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name, ID, or location..."
              className="w-full bg-[#111c2e] border border-white/10 rounded-md pl-9 pr-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#00d4ff]"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'Conveyor', 'Robotics'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${filter === f ? 'bg-[#ff6b35] text-white' : 'bg-[#111c2e] text-slate-300 border border-white/10 hover:bg-white/5'}`}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.map(e => (
            <div key={e.id} className="group bg-[#111c2e] border border-white/10 rounded-lg overflow-hidden hover:border-[#00d4ff]/40 transition-colors cursor-pointer" onClick={() => toast.success(`${e.id} loaded — diagnostic ready`)}>
              <div className="aspect-video bg-black/30 overflow-hidden relative">
                <img src={e.image} alt={e.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${statusStyle[e.status as keyof typeof statusStyle]}`}>
                  {e.status}
                </div>
              </div>
              <div className="p-4">
                <div className="text-[10px] font-mono text-[#00d4ff] uppercase tracking-wider">{e.id} · {e.type}</div>
                <div className="text-white font-semibold text-sm mt-1 truncate">{e.name}</div>
                <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                  <MapPin className="w-3 h-3" /> {e.location}
                </div>
              </div>
            </div>
          ))}
        </div>

        {list.length === 0 && (
          <div className="text-center py-16 text-slate-500">No equipment matches those filters.</div>
        )}
      </div>
    </section>
  );
};

export default EquipmentLibrary;
