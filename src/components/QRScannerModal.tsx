import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QrCode, Scan, CheckCircle2 } from 'lucide-react';
import { equipment } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from '@/components/ui/sonner';

interface Props {
  open: boolean;
  onClose: () => void;
}

const QRScannerModal: React.FC<Props> = ({ open, onClose }) => {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'found'>('idle');
  const [found, setFound] = useState(equipment[0]);
  const { setActiveEquipment } = useAppContext();

  useEffect(() => {
    if (!open) return;
    setPhase('scanning');
    const pick = equipment[Math.floor(Math.random() * equipment.length)];
    const t = setTimeout(() => {
      setFound(pick);
      setPhase('found');
    }, 1800);
    return () => clearTimeout(t);
  }, [open]);

  const startDiagnostic = () => {
    setActiveEquipment({
      id: found.id,
      name: found.name,
      type: found.type,
      location: found.location,
      status: found.status,
      image: found.image,
      lastService: found.lastService,
    });
    toast.success(`${found.id} locked in as active equipment`);
    onClose();
    setTimeout(() => {
      document.getElementById('diagnostic')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f1824] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <QrCode className="w-5 h-5 text-[#ff6b35]" /> Equipment QR Scanner
          </DialogTitle>
        </DialogHeader>

        <div className="relative aspect-square bg-black rounded-lg overflow-hidden border border-white/10">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          <div className="absolute inset-6 border-2 border-[#00d4ff]/50 rounded-lg">
            <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-[#00d4ff]" />
            <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-[#00d4ff]" />
            <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-[#00d4ff]" />
            <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-[#00d4ff]" />
          </div>

          {phase === 'scanning' && (
            <>
              <div className="absolute left-6 right-6 h-0.5 bg-[#00d4ff] shadow-[0_0_12px_#00d4ff] animate-[scan_1.8s_ease-in-out_infinite]" style={{ top: '50%' }} />
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <div className="inline-flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full">
                  <Scan className="w-3 h-3 text-[#00d4ff] animate-pulse" />
                  <span className="text-[#00d4ff] text-xs font-mono">SCANNING...</span>
                </div>
              </div>
            </>
          )}

          {phase === 'found' && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="bg-black/80 backdrop-blur rounded-lg p-4 text-center border border-[#00d4ff]/40">
                <CheckCircle2 className="w-10 h-10 text-[#00d4ff] mx-auto mb-2" />
                <div className="font-mono text-xs text-[#00d4ff] uppercase tracking-wider">Tag Matched</div>
                <div className="text-white font-bold mt-1">{found.id}</div>
              </div>
            </div>
          )}
        </div>

        {phase === 'found' && (
          <div className="bg-[#111c2e] rounded-lg p-4 border border-white/10">
            <div className="flex gap-3">
              <img src={found.image} alt={found.name} className="w-20 h-20 rounded object-cover" />
              <div className="flex-1">
                <div className="text-xs font-mono text-[#00d4ff]">{found.id}</div>
                <div className="font-semibold text-white">{found.name}</div>
                <div className="text-xs text-slate-400">{found.location}</div>
                <div className="text-xs text-slate-400 mt-1">Last service: {found.lastService}</div>
              </div>
            </div>
            <Button className="w-full mt-3 bg-[#ff6b35] hover:bg-[#ff8555]" onClick={startDiagnostic}>
              Start Diagnostic for {found.id}
            </Button>
          </div>
        )}

        <style>{`@keyframes scan { 0%, 100% { top: 10%; } 50% { top: 90%; } }`}</style>
      </DialogContent>
    </Dialog>
  );
};

export default QRScannerModal;
