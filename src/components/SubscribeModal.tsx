import React, { useEffect, useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/sonner';

const STRIPE_ACCOUNT_ID = 'acct_1TNUl6QjNZrU06Fo';
const PUBLISHABLE_KEY =
  'pk_live_51OJhJBHdGQpsHqInIzu7c6PzGPSH0yImD4xfpofvxvFZs0VFhPRXZCyEgYkkhOtBOXFWvssYASs851mflwQvjnrl00T6DbUwWZ';

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(PUBLISHABLE_KEY, { stripeAccount: STRIPE_ACCOUNT_ID });
  }
  return stripePromise;
};

const TIER_PRICES: Record<string, { label: string; price: string }> = {
  basic: { label: 'Basic', price: '$9.99/mo' },
  advanced: { label: 'Advanced', price: '$24.99/mo' },
  premium: { label: 'Premium', price: '$54.99/mo' },
};

interface PaymentFormProps {
  customerId: string;
  tier: string;
  email: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ customerId, tier, email, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setErr(null);
    try {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: window.location.origin + '/?checkout=success' },
        redirect: 'if_required',
      });
      if (error) {
        setErr(error.message || 'Payment failed');
        setLoading(false);
        return;
      }
      if (setupIntent?.status === 'succeeded') {
        const { data, error: subErr } = await supabase.functions.invoke('create-checkout', {
          body: { action: 'activate-subscription', customerId, tier, email },
        });
        if (subErr || data?.error) {
          setErr(data?.error || subErr?.message || 'Subscription failed');
          setLoading(false);
          return;
        }
        toast.success(`Subscribed to ${tier}!`);
        onSuccess();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-white p-3">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      {err && (
        <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded p-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{err}</span>
        </div>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading} className="flex-1">
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 bg-[#ff6b35] hover:bg-[#ff8555] text-white"
        >
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : 'Subscribe'}
        </Button>
      </div>
    </form>
  );
};

interface SubscribeModalProps {
  open: boolean;
  onClose: () => void;
  tier: string | null;
  email: string;
}

const SubscribeModal: React.FC<SubscribeModalProps> = ({ open, onClose, tier, email }) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const tierKey = (tier || '').toLowerCase();
  const tierInfo = TIER_PRICES[tierKey];

  useEffect(() => {
    if (!open || !tier || !email) return;
    setClientSecret(null);
    setCustomerId(null);
    setErr(null);
    setSuccess(false);
    setLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: { action: 'create-setup-intent', tier: tierKey, email, name: email.split('@')[0] },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        if (!data?.clientSecret || !data?.customerId) throw new Error('Could not initialize payment');
        setClientSecret(data.clientSecret);
        setCustomerId(data.customerId);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, tier, email, tierKey]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#0f1824] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">
            Subscribe — {tierInfo?.label || tier} <span className="text-[#ff6b35]">{tierInfo?.price}</span>
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400" />
            <div className="text-lg font-semibold">You're subscribed!</div>
            <div className="text-sm text-slate-400">Welcome to MTTR.ai {tierInfo?.label}.</div>
            <Button onClick={onClose} className="mt-2 bg-[#ff6b35] hover:bg-[#ff8555]">Done</Button>
          </div>
        ) : loading ? (
          <div className="py-10 flex items-center justify-center text-slate-300">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Preparing secure checkout…
          </div>
        ) : err ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{err}</span>
            </div>
            <Button onClick={onClose} variant="outline" className="w-full">Close</Button>
          </div>
        ) : clientSecret && customerId ? (
          <Elements
            stripe={getStripe()}
            options={{ clientSecret, appearance: { theme: 'stripe' } }}
          >
            <PaymentForm
              customerId={customerId}
              tier={tierKey}
              email={email}
              onSuccess={() => setSuccess(true)}
              onCancel={onClose}
            />
          </Elements>
        ) : null}

        <div className="text-[10px] text-slate-500 font-mono text-center pt-2 border-t border-white/10">
          SECURED BY STRIPE · LIVE MODE · CANCEL ANYTIME
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscribeModal;
