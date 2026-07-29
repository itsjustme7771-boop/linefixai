import React, { useState, useRef, useEffect } from 'react';
import Header from './Header';
import Hero from './Hero';
import DiagnosticDemo from './DiagnosticDemo';
import EquipmentLibrary from './EquipmentLibrary';
import CrossFixCards from './CrossFixCards';
import RoleTiers from './RoleTiers';
import Pricing from './Pricing';
import Footer from './Footer';
import AuthModal from './AuthModal';
import QRScannerModal from './QRScannerModal';
import SubscribeModal from './SubscribeModal';
import { useAppContext } from '@/contexts/AppContext';
import { hasSupabase, supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/sonner';

const AppLayout: React.FC = () => {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [scanOpen, setScanOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [saveCardSignal, setSaveCardSignal] = useState(0);
  const [subscribeTier, setSubscribeTier] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const pendingTierRef = useRef<string | null>(null);
  const pendingSaveCardRef = useRef(false);
  const { isAuthenticated, user, authLoading, refreshProfile } = useAppContext();

  const openAuth = (mode: 'signin' | 'signup') => { setAuthMode(mode); setAuthOpen(true); };
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const launchSubscribe = (tierName: string) => {
    const tier = tierName.toLowerCase();
    setCheckoutLoading(tier);
    setSubscribeTier(tier);
    setSubscribeOpen(true);
    // loading state clears once modal finishes initializing; clear quickly so UI feels responsive
    setTimeout(() => setCheckoutLoading(null), 400);
  };

  const handleSubscribe = (tierName: string) => {
    if (!isAuthenticated || !user?.email) {
      pendingTierRef.current = tierName;
      toast.info('Create your account to continue to checkout');
      openAuth('signup');
      return;
    }
    launchSubscribe(tierName);
  };

  const handleAuthenticated = (_email: string) => {
    const pending = pendingTierRef.current;
    pendingTierRef.current = null;
    if (pending) launchSubscribe(pending);

    if (pendingSaveCardRef.current) {
      pendingSaveCardRef.current = false;
      setSaveCardSignal((n) => n + 1);
    }
  };

  const requireAuthForSaveCard = () => {
    pendingSaveCardRef.current = true;
    openAuth('signin');
  };

  // Handle return URLs: Stripe checkout + Supabase email confirmation / password reset
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      toast.success('Payment confirmed — welcome aboard!');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!hasSupabase || !supabase || authLoading) return;

    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const authType = hashParams.get('type');

    if (authType === 'recovery') {
      toast.info('Set a new password using the reset form when it appears.');
      openAuth('signin');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (authType === 'signup' || authType === 'email' || authType === 'invite') {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          toast.success('Email confirmed — you are signed in.');
          window.history.replaceState({}, '', window.location.pathname);
        }
      });
    }
  }, [authLoading]);

  return (
    <div className="min-h-screen bg-[#0b1220] text-white">
      <Header
        onSignIn={() => openAuth('signin')}
        onSignUp={() => openAuth('signup')}
        onScan={() => setScanOpen(true)}
        onNav={scrollTo}
      />
      <main>
        <Hero onScan={() => setScanOpen(true)} onDemo={() => scrollTo('diagnostic')} />
        <DiagnosticDemo onRequireAuth={requireAuthForSaveCard} saveCardSignal={saveCardSignal} />
        <EquipmentLibrary onScan={() => setScanOpen(true)} />
        <CrossFixCards />
        <RoleTiers />
        <Pricing onSubscribe={handleSubscribe} loadingTier={checkoutLoading} />
      </main>
      <Footer />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
        onAuthenticated={handleAuthenticated}
      />
      <QRScannerModal open={scanOpen} onClose={() => setScanOpen(false)} />
      <SubscribeModal
        open={subscribeOpen}
        onClose={() => { setSubscribeOpen(false); setSubscribeTier(null); }}
        tier={subscribeTier}
        email={user?.email || ''}
        onSubscribed={() => { void refreshProfile(); }}
      />
    </div>
  );
};

export default AppLayout;
