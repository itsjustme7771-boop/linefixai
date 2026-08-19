import React from 'react';
import { tiers } from '@/data/mockData';
import { Check, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PricingProps {
  onSubscribe: (tier: string) => void;
  loadingTier?: string | null;
}

const Pricing: React.FC<PricingProps> = ({ onSubscribe, loadingTier }) => {
  return (
    <section id="pricing" className="py-20 bg-[#0f1824] relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#ff6b35]/10 rounded-full blur-3xl" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="text-[#00d4ff] text-xs font-mono uppercase tracking-widest mb-3">04 — Subscription</div>
          <h2 className="text-3xl lg:text-5xl font-black text-white tracking-tight">Pricing built for plant floor teams.</h2>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">One subscription. Three tiers. Cancel anytime. Every tier includes safety-first diagnostic formatting.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map(t => {
            const tierKey = t.name.toLowerCase();
            const isLoading = loadingTier === tierKey;
            return (
              <div
                key={t.name}
                className={`relative rounded-2xl p-6 flex flex-col ${t.highlight ? 'bg-gradient-to-b from-[#ff6b35] to-[#ff8555] text-white shadow-2xl shadow-[#ff6b35]/30 lg:scale-105' : 'bg-[#111c2e] border border-white/10 text-white'}`}
              >
                {t.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0f1824] border border-white/20 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-widest text-[#00d4ff] flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Most Popular
                  </div>
                )}

                <div className={`text-xs font-mono uppercase tracking-widest ${t.highlight ? 'text-white/80' : 'text-[#00d4ff]'}`}>{t.name}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-5xl font-black">${t.price}</span>
                  <span className={`text-sm ${t.highlight ? 'text-white/80' : 'text-slate-400'}`}>/mo</span>
                </div>
                <div className={`text-sm mt-1 ${t.highlight ? 'text-white/90' : 'text-slate-400'}`}>{t.tagline}</div>

                <ul className="mt-6 space-y-3 flex-1">
                  {t.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${t.highlight ? 'text-white' : 'text-[#00d4ff]'}`} />
                      <span className={t.highlight ? 'text-white' : 'text-slate-200'}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => onSubscribe(t.name)}
                  disabled={isLoading}
                  className={`mt-6 w-full font-semibold h-11 disabled:opacity-70 ${t.highlight ? 'bg-[#0f1824] text-white hover:bg-[#1a2638]' : 'bg-[#ff6b35] hover:bg-[#ff8555] text-white'}`}
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting checkout…</>
                  ) : t.cta}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center text-xs text-slate-500 font-mono">
          SECURED BY STRIPE · CANCEL ANYTIME · ANNUAL BILLING SAVES 20%
        </div>
      </div>
    </section>
  );
};

export default Pricing;
