import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, Lock, User, ArrowLeft, HardHat, Star, BarChart3 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useAppContext, UserRole } from '@/contexts/AppContext';
import { hasSupabase, supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup' | 'forgot';

interface Props {
  open: boolean;
  onClose: () => void;
  initialMode?: Mode;
  onAuthenticated?: (email: string) => void;
}

const AuthModal: React.FC<Props> = ({ open, onClose, initialMode = 'signin', onAuthenticated }) => {
  const { signInWithPassword, signUpWithPassword, signInLocal } = useAppContext();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<UserRole>('technician');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setMode(initialMode);
      setSubmitting(false);
      setError(null);
    }
    wasOpen.current = open;
  }, [open, initialMode]);

  const finish = (authedEmail: string) => {
    setTimeout(() => {
      setSubmitting(false);
      onClose();
      onAuthenticated?.(authedEmail);
    }, 30);
  };

  const handleSignIn = async () => {
    const { error: err } = await signInWithPassword(email, password);
    if (err) {
      setError(err);
      setSubmitting(false);
      toast.error(err);
      return;
    }
    toast.success(`Signed in as ${email}`);
    finish(email.trim());
  };

  const handleSignUp = async () => {
    const { error: err } = await signUpWithPassword(email, password, name, role);
    if (err) {
      // Supabase returns messaging like "check your email" via error, surface nicely
      setError(err);
      setSubmitting(false);
      if (err.toLowerCase().includes('check your email')) {
        toast.success(err);
        onClose();
      } else {
        toast.error(err);
      }
      return;
    }
    toast.success(`Account created — ${role} tier`);
    finish(email.trim());
  };

  const handleForgot = async () => {
    if (!hasSupabase || !supabase) {
      toast.error('Password reset is not configured');
      setSubmitting(false);
      return;
    }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });
    if (err) {
      setError(err.message);
      setSubmitting(false);
      toast.error(err.message);
      return;
    }
    toast.success('Reset link sent — check your inbox');
    setSubmitting(false);
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (submitting) return;
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) { toast.error('Please enter your email'); return; }

    if (mode === 'forgot') {
      setSubmitting(true);
      handleForgot();
      return;
    }

    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);

    // If Supabase isn't configured, fall back to local-only demo auth so UI still works
    if (!hasSupabase) {
      signInLocal(trimmedEmail, role, name || undefined);
      toast.success(`Signed in (demo mode) as ${role}`);
      finish(trimmedEmail);
      return;
    }

    if (mode === 'signin') {
      handleSignIn();
    } else {
      handleSignUp();
    }
  };

  const handleOpenChange = (next: boolean) => { if (!next) onClose(); };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#0f1824] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            {mode === 'forgot' && (
              <button type="button" onClick={() => setMode('signin')} className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {mode === 'signin' && 'Sign in to MTTR.ai'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'forgot' && 'Reset your password'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <Field icon={<User className="w-4 h-4" />} type="text" placeholder="Full name" value={name} onChange={setName} required />
          )}

          <Field icon={<Mail className="w-4 h-4" />} type="email" placeholder="you@plant.com" value={email} onChange={setEmail} required autoComplete="email" />

          {mode !== 'forgot' && (
            <Field
              icon={<Lock className="w-4 h-4" />}
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={setPassword}
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          )}

          {mode === 'signup' && (
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2">Select your role</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'technician' as const, label: 'Technician', icon: <HardHat className="w-4 h-4" /> },
                  { id: 'lead' as const, label: 'Lead', icon: <Star className="w-4 h-4" /> },
                  { id: 'management' as const, label: 'Mgmt', icon: <BarChart3 className="w-4 h-4" /> },
                ].map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-md border text-xs transition-colors ${role === r.id ? 'bg-[#ff6b35]/15 border-[#ff6b35] text-white' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
                  >
                    {r.icon}{r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'signin' && (
            <button type="button" onClick={() => setMode('forgot')} className="text-xs text-[#00d4ff] hover:underline">
              Forgot password?
            </button>
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full bg-[#ff6b35] hover:bg-[#ff8555] text-white font-semibold h-11 disabled:opacity-70">
            {submitting ? 'Please wait…' : (
              <>
                {mode === 'signin' && 'Sign In'}
                {mode === 'signup' && 'Create Account'}
                {mode === 'forgot' && 'Send Reset Link'}
              </>
            )}
          </Button>
        </form>

        <div className="text-center text-xs text-slate-400">
          {mode === 'signin' ? (
            <>New here? <button type="button" onClick={() => setMode('signup')} className="text-[#00d4ff] hover:underline">Create account</button></>
          ) : mode === 'signup' ? (
            <>Already have an account? <button type="button" onClick={() => setMode('signin')} className="text-[#00d4ff] hover:underline">Sign in</button></>
          ) : (
            <>Remembered it? <button type="button" onClick={() => setMode('signin')} className="text-[#00d4ff] hover:underline">Back to sign in</button></>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Field: React.FC<{
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}> = ({ icon, type, placeholder, value, onChange, required, minLength, autoComplete }) => (
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      minLength={minLength}
      autoComplete={autoComplete}
      className="w-full bg-white/5 border border-white/10 rounded-md pl-10 pr-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#00d4ff]"
    />
  </div>
);

export default AuthModal;
