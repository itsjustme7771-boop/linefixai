import React, { useState } from 'react';
import { Wrench, Mail, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

const Footer: React.FC = () => {
  const [email, setEmail] = useState('');

  const subscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { toast.error('Enter a valid email'); return; }
    toast.success('Subscribed — uptime reports incoming');
    setEmail('');
  };

  const cols = [
    { title: 'Product', links: ['Diagnostic Engine', 'QR Scanner', 'Cross-Fix Cards', 'Manual Library', 'Analytics'] },
    { title: 'Roles', links: ['Technicians', 'Lead Techs', 'Maintenance Mgrs', 'Plant Directors', 'Enterprise'] },
    { title: 'Resources', links: ['VFD Fault Codes', 'PLC I/O Guide', 'Safety Protocols', 'API Docs', 'Changelog'] },
    { title: 'Company', links: ['About', 'Customers', 'Security', 'Privacy', 'Terms'] },
  ];

  return (
    <footer className="bg-[#080f1a] border-t border-white/10 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid lg:grid-cols-6 gap-10">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-md bg-gradient-to-br from-[#ff6b35] to-[#ff8f5c] flex items-center justify-center">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-white font-bold text-lg">MTTR<span className="text-[#00d4ff]">.ai</span></div>
                <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Diagnostic Engine</div>
              </div>
            </div>
            <p className="text-sm text-slate-400 max-w-sm">
              Safety-first, plant-floor-ready diagnostics for high-speed manufacturing. Built with techs, for techs.
            </p>

            <form onSubmit={subscribe} className="mt-5 flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@plant.com"
                className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00d4ff]"
              />
              <Button type="submit" className="bg-[#ff6b35] hover:bg-[#ff8555]">Subscribe</Button>
            </form>

            <div className="mt-6 space-y-2 text-xs text-slate-500">
              <div className="flex items-center gap-2"><Mail className="w-3 h-3" /> support@mttr.ai</div>
              <div className="flex items-center gap-2"><Phone className="w-3 h-3" /> +1 (555) 022-0480</div>
              <div className="flex items-center gap-2"><MapPin className="w-3 h-3" /> Austin · Columbus · Reno</div>
            </div>
          </div>

          {cols.map(col => (
            <div key={col.title}>
              <div className="text-xs font-mono uppercase tracking-widest text-[#00d4ff] mb-3">{col.title}</div>
              <ul className="space-y-2">
                {col.links.map(l => (
                  <li key={l}>
                    <button onClick={() => toast(`${l} — coming soon`)} className="text-sm text-slate-400 hover:text-white transition-colors">
                      {l}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-slate-500 font-mono">© 2026 MTTR.AI — ALL SYSTEMS NOMINAL</div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> API operational</span>
            <span className="font-mono">v2.4.1</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
