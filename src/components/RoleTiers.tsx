import React from 'react';
import { HardHat, Star, BarChart3, Check, X } from 'lucide-react';

const tiers = [
  {
    name: 'Technician',
    icon: HardHat,
    color: 'from-slate-500 to-slate-700',
    perms: [
      { label: 'Run AI diagnostics', allowed: true },
      { label: 'Scan equipment QR codes', allowed: true },
      { label: 'View shared manuals', allowed: true },
      { label: 'Apply Cross-Fix Cards', allowed: true },
      { label: 'Upload manuals / docs', allowed: false },
      { label: 'Create Cross-Fix Cards', allowed: false },
      { label: 'View plant analytics', allowed: false },
    ],
  },
  {
    name: 'Lead',
    icon: Star,
    color: 'from-[#00d4ff] to-[#0099cc]',
    perms: [
      { label: 'Everything Technicians can do', allowed: true },
      { label: 'Upload PDFs, DOCX, schematics', allowed: true },
      { label: 'Create & edit Cross-Fix Cards', allowed: true },
      { label: 'Approve drafted fixes', allowed: true },
      { label: 'View team activity feed', allowed: true },
      { label: 'Multi-plant admin', allowed: false },
      { label: 'Billing & user management', allowed: false },
    ],
  },
  {
    name: 'Management',
    icon: BarChart3,
    color: 'from-[#ff6b35] to-[#ff8f5c]',
    perms: [
      { label: 'Everything Leads can do', allowed: true },
      { label: 'Multi-plant oversight dashboard', allowed: true },
      { label: 'MTTR analytics & reports', allowed: true },
      { label: 'Role assignment & audit logs', allowed: true },
      { label: 'Billing & subscription mgmt', allowed: true },
      { label: 'Cross-plant knowledge policy', allowed: true },
      { label: 'Export to CMMS / SAP', allowed: true },
    ],
  },
];

const RoleTiers: React.FC = () => (
  <section className="py-20 bg-[#0f1824]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <div className="text-[#00d4ff] text-xs font-mono uppercase tracking-widest mb-3">05 — Role-Based Access</div>
        <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight">Three tiers. One plant floor.</h2>
        <p className="mt-3 text-slate-400 max-w-2xl mx-auto">Tight permissions so techs stay focused, leads can codify knowledge, and managers get the view across every plant.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {tiers.map(t => {
          const Icon = t.icon;
          return (
            <div key={t.name} className="bg-[#111c2e] border border-white/10 rounded-xl overflow-hidden">
              <div className={`bg-gradient-to-br ${t.color} p-5`}>
                <Icon className="w-6 h-6 text-white" />
                <div className="mt-2 text-white font-bold text-xl">{t.name}</div>
              </div>
              <ul className="p-5 space-y-2.5">
                {t.perms.map(p => (
                  <li key={p.label} className="flex items-start gap-2 text-sm">
                    {p.allowed ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <X className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                    )}
                    <span className={p.allowed ? 'text-slate-200' : 'text-slate-500 line-through'}>{p.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

export default RoleTiers;
