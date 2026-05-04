import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BookmarkPlus, ShieldCheck, Lock } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useCrossFixCards, type NewCrossFixCard } from '@/hooks/useCrossFixCards';
import { toast } from '@/components/ui/sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  prefill: {
    title: string;
    symptoms: string;
    rootCause: string;
    solution: string;
    parts: string[];
    timeToFix: string;
    tags: string[];
    equipmentId?: string | null;
    equipmentName?: string | null;
    plant?: string | null;
    sessionId?: string | null;
  };
}

const SaveCrossFixCardModal: React.FC<Props> = ({ open, onClose, prefill }) => {
  const { role, userName } = useAppContext();
  const { submit } = useCrossFixCards();

  const [title, setTitle] = useState(prefill.title);
  const [symptoms, setSymptoms] = useState(prefill.symptoms);
  const [rootCause, setRootCause] = useState(prefill.rootCause);
  const [solution, setSolution] = useState(prefill.solution);
  const [parts, setParts] = useState(prefill.parts.join(', '));
  const [timeToFix, setTimeToFix] = useState(prefill.timeToFix);
  const [tags, setTags] = useState(prefill.tags.join(', '));
  const [saving, setSaving] = useState(false);

  // Re-prefill on open
  useEffect(() => {
    if (!open) return;
    setTitle(prefill.title);
    setSymptoms(prefill.symptoms);
    setRootCause(prefill.rootCause);
    setSolution(prefill.solution);
    setParts(prefill.parts.join(', '));
    setTimeToFix(prefill.timeToFix);
    setTags(prefill.tags.join(', '));
  }, [open, prefill]);

  const canApprove = role === 'lead' || role === 'management';

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      const draft: NewCrossFixCard = {
        title: title.trim(),
        author: userName,
        author_role: role,
        symptoms: symptoms.trim(),
        root_cause: rootCause.trim(),
        solution: solution.trim(),
        time_to_fix: timeToFix.trim() || '—',
        parts: parts.split(',').map(p => p.trim()).filter(Boolean),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        equipment_id: prefill.equipmentId ?? null,
        equipment_name: prefill.equipmentName ?? null,
        plant: prefill.plant ?? null,
        source_session_id: prefill.sessionId ?? null,
      };
      const { autoApproved } = await submit(draft);
      toast.success(
        autoApproved
          ? 'Cross-Fix Card approved and synced to all plants'
          : 'Card submitted — awaiting Lead/Management approval',
      );
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f1824] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <BookmarkPlus className="w-5 h-5 text-[#ff6b35]" /> Save as Cross-Fix Card
          </DialogTitle>
        </DialogHeader>

        <div className={`rounded-md p-3 border flex items-center gap-2 text-xs ${
          canApprove
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          {canApprove ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          <span className="font-mono uppercase tracking-wider">
            {canApprove
              ? `${role.toUpperCase()} · auto-approved & synced in real time`
              : 'TECHNICIAN · submits for Lead/Management approval'}
          </span>
        </div>

        {prefill.equipmentId && (
          <div className="bg-[#111c2e] border border-white/10 rounded-md p-3 text-xs text-slate-300">
            <span className="font-mono text-[#00d4ff]">ACTIVE EQUIPMENT:</span>{' '}
            <span className="font-semibold">{prefill.equipmentId}</span> — {prefill.equipmentName}
          </div>
        )}

        <div className="space-y-3">
          <Field label="Title" required>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[#0b1220] border border-white/10 rounded-md p-2 text-sm text-white focus:outline-none focus:border-[#00d4ff]"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Time to fix">
              <input
                value={timeToFix}
                onChange={e => setTimeToFix(e.target.value)}
                placeholder="e.g. 12 min"
                className="w-full bg-[#0b1220] border border-white/10 rounded-md p-2 text-sm text-white focus:outline-none focus:border-[#00d4ff]"
              />
            </Field>
            <Field label="Tags (comma-separated)">
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="post-sanitation, conveyor"
                className="w-full bg-[#0b1220] border border-white/10 rounded-md p-2 text-sm text-white focus:outline-none focus:border-[#00d4ff]"
              />
            </Field>
          </div>

          <Field label="Symptoms (what the tech saw)">
            <textarea
              value={symptoms}
              onChange={e => setSymptoms(e.target.value)}
              rows={2}
              className="w-full bg-[#0b1220] border border-white/10 rounded-md p-2 text-sm text-white focus:outline-none focus:border-[#00d4ff]"
            />
          </Field>

          <Field label="Root cause">
            <textarea
              value={rootCause}
              onChange={e => setRootCause(e.target.value)}
              rows={2}
              className="w-full bg-[#0b1220] border border-white/10 rounded-md p-2 text-sm text-white focus:outline-none focus:border-[#00d4ff]"
            />
          </Field>

          <Field label="Solution (what fixed it)">
            <textarea
              value={solution}
              onChange={e => setSolution(e.target.value)}
              rows={3}
              className="w-full bg-[#0b1220] border border-white/10 rounded-md p-2 text-sm text-white focus:outline-none focus:border-[#00d4ff]"
            />
          </Field>

          <Field label="Parts used (comma-separated)">
            <input
              value={parts}
              onChange={e => setParts(e.target.value)}
              placeholder="CR-14 Relay, Dielectric grease"
              className="w-full bg-[#0b1220] border border-white/10 rounded-md p-2 text-sm text-white focus:outline-none focus:border-[#00d4ff]"
            />
          </Field>
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
          <Button variant="outline" onClick={onClose} className="border-white/20 text-slate-200 hover:bg-white/5">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-[#ff6b35] hover:bg-[#ff8555] text-white font-semibold"
          >
            {saving ? 'Saving...' : canApprove ? 'Publish to Network' : 'Submit for Approval'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div>
    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 block">
      {label} {required && <span className="text-[#ff6b35]">*</span>}
    </label>
    {children}
  </div>
);

export default SaveCrossFixCardModal;
