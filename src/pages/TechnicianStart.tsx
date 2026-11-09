import React, { useEffect, useRef, useState } from 'react';
import { Camera, Upload, MessageSquareText, ArrowLeft, Image as ImageIcon, ShieldAlert } from 'lucide-react';
import DiagnosticDemo from '@/components/DiagnosticDemo';
import { streamDiagnosis } from '@/lib/diagnosticStream';
import { hasSupabase } from '@/lib/supabase';

type Mode = 'choose' | 'photo' | 'diagnose';

const TechnicianStart: React.FC = () => {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('choose');
  const [photo, setPhoto] = useState<{ name: string; url: string } | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [issue, setIssue] = useState('');
  const [result, setResult] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const selectPhoto = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setPhotoError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Choose a photo file.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setPhotoError('Choose a JPEG, PNG or WebP photo smaller than 4 MB.');
      return;
    }
    setSelectedFile(file);
    setResult('');
    setPhoto({ name: file.name, url: URL.createObjectURL(file) });
    setMode('photo');
  };

  const analyzePhoto = async () => {
    if (!selectedFile || running) return;
    if (!hasSupabase) {
      setPhotoError('Live AI is not configured. Photo analysis is unavailable.');
      return;
    }
    setPhotoError('');
    setRunning(true);
    setResult('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('Could not read photo'));
        reader.onerror = () => reject(new Error('Could not read photo'));
        reader.readAsDataURL(selectedFile);
      });
      await streamDiagnosis({
        issue: issue.trim() || 'Inspect this equipment photograph. Report visible observations and ask for missing symptoms.',
        imageDataUrl: dataUrl,
        onToken: (_chunk, full) => setResult(full),
      });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Photo analysis failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b1220] text-white">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <div className="mb-10 flex items-center justify-between gap-4">
          <a href="/" className="font-black tracking-wide text-[#00d4ff] text-xl">LineFix AI</a>
          <a href="/" className="text-sm text-slate-300 hover:text-white">Company site</a>
        </div>
        <div className="mb-7">
          <p className="text-xs font-mono uppercase tracking-widest text-[#00d4ff]">Technician workspace</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-black">What's wrong with your equipment?</h1>
          <p className="mt-3 text-slate-300">Start with a picture or a short description. Keep it simple.</p>
        </div>

        <input ref={cameraRef} className="hidden" type="file" accept="image/*" capture="environment"
          aria-label="Take an equipment photo" onChange={e => { selectPhoto(e.target.files); e.target.value = ''; }} />
        <input ref={uploadRef} className="hidden" type="file" accept="image/*"
          aria-label="Upload an equipment photo" onChange={e => { selectPhoto(e.target.files); e.target.value = ''; }} />

        {mode === 'choose' && (
          <div className="grid gap-4 sm:grid-cols-3">
            <button onClick={() => cameraRef.current?.click()} className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-white/15 bg-[#111c2e] p-6 text-center hover:border-[#00d4ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00d4ff]">
              <Camera className="mb-4 h-10 w-10 text-[#00d4ff]" />
              <span className="font-bold text-lg">Take a picture</span>
              <span className="mt-2 text-xs text-slate-400">Use your phone camera</span>
            </button>
            <button onClick={() => uploadRef.current?.click()} className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-white/15 bg-[#111c2e] p-6 text-center hover:border-[#00d4ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00d4ff]">
              <Upload className="mb-4 h-10 w-10 text-[#00d4ff]" />
              <span className="font-bold text-lg">Upload a picture</span>
              <span className="mt-2 text-xs text-slate-400">Choose one from your device</span>
            </button>
            <button onClick={() => setMode('diagnose')} className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-white/15 bg-[#111c2e] p-6 text-center hover:border-[#00d4ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00d4ff]">
              <MessageSquareText className="mb-4 h-10 w-10 text-[#00d4ff]" />
              <span className="font-bold text-lg">Describe the problem</span>
              <span className="mt-2 text-xs text-slate-400">Use the existing text diagnostics</span>
            </button>
          </div>
        )}

        {photoError && <p role="alert" className="mt-4 text-sm text-orange-300">{photoError}</p>}

        {mode === 'photo' && photo && (
          <div className="rounded-xl border border-white/15 bg-[#111c2e] p-5">
            <div className="flex items-center gap-2 text-[#00d4ff] font-semibold"><ImageIcon className="h-5 w-5" /> Photo selected</div>
            <img src={photo.url} alt="Selected equipment" className="mt-4 max-h-80 w-full rounded-lg object-contain bg-black/20" />
            <p className="mt-2 text-xs text-slate-400 break-all">{photo.name}</p>
            <label htmlFor="photo-issue" className="mt-5 block text-sm text-slate-200">What's happening? (optional)</label>
            <textarea id="photo-issue" value={issue} onChange={e => setIssue(e.target.value)}
              placeholder="For example: conveyor won't start after washdown" maxLength={10000}
              className="mt-2 min-h-24 w-full rounded-lg border border-white/20 bg-[#0b1220] p-3 text-white" />
            <p className="mt-3 text-xs text-slate-400">When you choose Analyze photo, this image will be sent securely to the diagnostic AI. Only upload photos you're allowed to share. AI observations are not a verified diagnosis.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={analyzePhoto} disabled={running || !hasSupabase}
                className="rounded-lg bg-[#ff6b35] px-5 py-3 font-semibold hover:bg-[#ff8555] disabled:opacity-50">
                {running ? 'Analyzing…' : 'Analyze photo'}
              </button>
              <button onClick={() => uploadRef.current?.click()} disabled={running} className="rounded-lg border border-white/20 px-5 py-3">Choose another photo</button>
              <button onClick={() => setMode('diagnose')} disabled={running} className="rounded-lg border border-white/20 px-5 py-3">Text diagnostics instead</button>
            </div>
            {!hasSupabase && <p className="mt-3 text-amber-200">Live AI is not configured for this environment.</p>}
            {result && <div role="status" aria-live="polite" className="mt-6 rounded-xl border border-white/15 bg-[#0b1220] p-5">
              <h2 className="mb-3 font-bold text-[#00d4ff]">AI diagnostic guidance</h2>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-100">{result}</pre>
            </div>}
          </div>
        )}

        {mode === 'diagnose' && (
          <div>
            <button onClick={() => setMode(photo ? 'photo' : 'choose')} className="mb-3 flex items-center gap-2 text-sm text-[#00d4ff]"><ArrowLeft className="h-4 w-4" /> Back</button>
            {photo && <p className="mb-3 rounded-lg border border-white/15 p-3 text-sm text-slate-300">Photo selected. Use Analyze photo on the previous screen for image-based guidance. Text diagnostics here do not include the image.</p>}
            <DiagnosticDemo />
          </div>
        )}

        <p className="mt-8 flex items-start gap-2 text-xs text-slate-400"><ShieldAlert className="h-4 w-4 shrink-0" /> Follow plant safety procedures, lockout/tagout requirements, and qualified electrical-work rules. AI suggestions are not a substitute for safe verification.</p>
      </div>
    </main>
  );
};

export default TechnicianStart;
