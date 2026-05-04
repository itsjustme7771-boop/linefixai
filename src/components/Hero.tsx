import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { QrCode, Zap, ShieldAlert, Clock } from 'lucide-react';

interface HeroProps {
  onScan: () => void;
  onDemo: () => void;
}

const Hero: React.FC<HeroProps> = ({ onScan, onDemo }) => {
  const [uptime, setUptime] = useState(99.12);
  const [fixes, setFixes] = useState(14287);

  useEffect(() => {
    const t = setInterval(() => {
      setUptime(u => +(u + (Math.random() * 0.02 - 0.01)).toFixed(2));
      setFixes(f => f + Math.floor(Math.random() * 3));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#0f1824]">
      <div className="absolute inset-0">
        <img
          src="https://d64gsuwffb70l.cloudfront.net/69e34835761c0e06a939e66c_1776503016269_0f549e25.png"
          alt="Industrial plant floor"
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f1824] via-[#0f1824]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1824] via-transparent to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff6b35]/10 border border-[#ff6b35]/30 mb-6">
            <span className="w-2 h-2 rounded-full bg-[#ff6b35] animate-pulse" />
            <span className="text-[#ff6b35] text-xs font-mono uppercase tracking-widest">AI Diagnostic Engine — Live</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight">
            Cut Downtime <span className="text-[#ff6b35]">in Half</span> with AI-Powered Diagnostics.
          </h1>

          <p className="mt-6 text-lg text-slate-300 max-w-2xl">
            Scan equipment. Get safety-first troubleshooting in seconds. Share fixes across every plant, in real time.
            Built by techs, for techs — on the plant floor.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button onClick={onDemo} size="lg" className="bg-[#ff6b35] hover:bg-[#ff8555] text-white font-semibold h-12 px-6">
              <Zap className="w-4 h-4 mr-2" /> Run Live Diagnostic
            </Button>
            <Button onClick={onScan} size="lg" variant="outline" className="h-12 px-6 bg-white/5 border-white/20 text-white hover:bg-white/10">
              <QrCode className="w-4 h-4 mr-2" /> Scan Equipment QR
            </Button>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-4 max-w-2xl">
            <Stat icon={<Clock className="w-4 h-4" />} label="Avg MTTR" value="-47%" sub="vs baseline" />
            <Stat icon={<Zap className="w-4 h-4" />} label="Uptime" value={`${uptime}%`} sub="network-wide" mono />
            <Stat icon={<ShieldAlert className="w-4 h-4" />} label="Fixes Logged" value={fixes.toLocaleString()} sub="all plants" mono />
          </div>
        </div>
      </div>
    </section>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string; sub: string; mono?: boolean }> = ({ icon, label, value, sub, mono }) => (
  <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-4">
    <div className="flex items-center gap-2 text-[#00d4ff] text-xs uppercase tracking-wider font-semibold">
      {icon} {label}
    </div>
    <div className={`mt-2 text-2xl lg:text-3xl font-bold text-white ${mono ? 'font-mono' : ''}`}>{value}</div>
    <div className="text-xs text-slate-400 mt-1">{sub}</div>
  </div>
);

export default Hero;
