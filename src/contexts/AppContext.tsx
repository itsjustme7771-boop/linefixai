import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase, hasSupabase } from '@/lib/supabase';

export type UserRole = 'technician' | 'lead' | 'management';

export interface ActiveEquipment {
  id: string;
  name: string;
  type?: string;
  location?: string;
  status?: string;
  image?: string;
  lastService?: string;
  plant?: string;
}

export type SubscriptionTier = 'basic' | 'advanced' | 'premium';

export interface AuthUser {
  id?: string;
  email: string;
  name: string;
  role: UserRole;
  subscriptionTier?: SubscriptionTier | null;
  subscriptionStatus?: string | null;
}

export interface AppliedCrossFix {
  title: string;
  symptoms: string;
  solution: string;
  equipmentId?: string | null;
  equipmentName?: string | null;
  plant?: string | null;
}

interface AppContextType {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  activeEquipment: ActiveEquipment | null;
  setActiveEquipment: (eq: ActiveEquipment | null) => void;
  appliedCrossFix: AppliedCrossFix | null;
  applyCrossFix: (fix: AppliedCrossFix) => void;
  clearAppliedCrossFix: () => void;
  role: UserRole;
  setRole: (r: UserRole) => void;
  userName: string;

  // Auth
  isAuthenticated: boolean;
  user: AuthUser | null;
  authLoading: boolean;
  /** Bumps when auth user id changes — use as a dependency to refetch user-scoped data */
  authVersion: number;
  // Local-only fallback (when no Supabase configured)
  signInLocal: (email: string, role: UserRole, name?: string) => void;
  // Supabase-backed auth. Returns { error } on failure.
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithPassword: (email: string, password: string, name: string, role: UserRole) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const defaultAppContext: AppContextType = {
  sidebarOpen: false,
  toggleSidebar: () => {},
  activeEquipment: null,
  setActiveEquipment: () => {},
  appliedCrossFix: null,
  applyCrossFix: () => {},
  clearAppliedCrossFix: () => {},
  role: 'lead',
  setRole: () => {},
  userName: 'Demo Lead',
  isAuthenticated: false,
  user: null,
  authLoading: true,
  authVersion: 0,
  signInLocal: () => {},
  signInWithPassword: async () => ({ error: 'Not configured' }),
  signUpWithPassword: async () => ({ error: 'Not configured' }),
  signOut: async () => {},
  refreshProfile: async () => {},
};

const AppContext = createContext<AppContextType>(defaultAppContext);

export const useAppContext = () => useContext(AppContext);

const USER_KEY = 'mttr.user';
const ROLE_KEY = 'mttr.role';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeEquipment, setActiveEquipmentState] = useState<ActiveEquipment | null>(null);
  const [appliedCrossFix, setAppliedCrossFix] = useState<AppliedCrossFix | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(hasSupabase);
  const [authVersion, setAuthVersion] = useState(0);

  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.email === 'string' && parsed.role) return parsed as AuthUser;
    } catch { /* ignore */ }
    return null;
  });

  const [role, setRoleState] = useState<UserRole>(() => {
    try {
      const r = localStorage.getItem(ROLE_KEY);
      if (r === 'technician' || r === 'lead' || r === 'management') return r;
    } catch { /* ignore */ }
    return 'lead';
  });

  // Keep role in sync with signed-in user
  useEffect(() => {
    if (user?.role) setRoleState(user.role);
  }, [user]);

  // Hydrate auth from Supabase session on load + listen to changes
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    let mounted = true;

    const applyUser = (next: AuthUser) => {
      if (!mounted) return;
      setUser(next);
      setAuthVersion(v => v + 1);
      try { localStorage.setItem(USER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    };

    const loadProfile = async (uid: string, fallbackEmail: string, fallbackName?: string, fallbackRole?: UserRole) => {
      const email = fallbackEmail.trim();
      const name = fallbackName?.trim() || email.split('@')[0] || 'User';
      const roleFallback = fallbackRole || 'technician';

      try {
        const { data } = await supabase!
          .from('profiles')
          .select('id,email,name,role,subscription_tier,subscription_status')
          .eq('id', uid)
          .maybeSingle();

        if (data) {
          applyUser({
            id: data.id,
            email: data.email || email,
            name: data.name || name,
            role: (data.role as UserRole) || roleFallback,
            subscriptionTier: data.subscription_tier as SubscriptionTier | null,
            subscriptionStatus: data.subscription_status,
          });
          return;
        }

        // Profile missing (pre-trigger account or race) — create it
        const { data: created } = await supabase!
          .from('profiles')
          .upsert({ id: uid, email, name, role: roleFallback }, { onConflict: 'id' })
          .select('id,email,name,role,subscription_tier,subscription_status')
          .maybeSingle();

        if (created) {
          applyUser({
            id: created.id,
            email: created.email || email,
            name: created.name || name,
            role: (created.role as UserRole) || roleFallback,
            subscriptionTier: created.subscription_tier as SubscriptionTier | null,
            subscriptionStatus: created.subscription_status,
          });
          return;
        }
      } catch { /* ignore */ }

      applyUser({ id: uid, email, name, role: roleFallback });
    };

    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (session?.user) {
        const meta = (session.user.user_metadata || {}) as any;
        loadProfile(session.user.id, session.user.email || '', meta.name, meta.role as UserRole);
      }
      if (mounted) setAuthLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const meta = (session.user.user_metadata || {}) as Record<string, unknown>;
        loadProfile(
          session.user.id,
          session.user.email || '',
          typeof meta.name === 'string' ? meta.name : undefined,
          meta.role as UserRole | undefined,
        );
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setAuthVersion(v => v + 1);
        try { localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
      }
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const toggleSidebar = () => setSidebarOpen((p) => !p);

  const setActiveEquipment = useCallback((eq: ActiveEquipment | null) => {
    setActiveEquipmentState(eq);
  }, []);

  const applyCrossFix = useCallback((fix: AppliedCrossFix) => {
    setAppliedCrossFix(fix);
    if (fix.equipmentId && fix.equipmentName) {
      setActiveEquipmentState({
        id: fix.equipmentId,
        name: fix.equipmentName,
        plant: fix.plant ?? undefined,
        location: fix.plant ?? undefined,
      });
    }
  }, []);

  const clearAppliedCrossFix = useCallback(() => setAppliedCrossFix(null), []);

  const setRole = useCallback((r: UserRole) => {
    setRoleState(r);
    try { localStorage.setItem(ROLE_KEY, r); } catch { /* ignore */ }
  }, []);

  const signInLocal = useCallback((email: string, r: UserRole, name?: string) => {
    const trimmed = email.trim();
    const derivedName = name?.trim() || trimmed.split('@')[0] || 'Tech User';
    const next: AuthUser = { email: trimmed, role: r, name: derivedName };
    setUser(next);
    setRoleState(r);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      localStorage.setItem(ROLE_KEY, r);
    } catch { /* ignore */ }
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Auth is not configured' };
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: error.message };
    if (data.user) {
      // Load profile to get role/name
      const { data: profile } = await supabase
        .from('profiles')
        .select('id,email,name,role,subscription_tier,subscription_status')
        .eq('id', data.user.id)
        .maybeSingle();
      const meta = (data.user.user_metadata || {}) as any;
      const next: AuthUser = {
        id: data.user.id,
        email: data.user.email || email.trim(),
        name: profile?.name || meta.name || (data.user.email || email).split('@')[0],
        role: (profile?.role as UserRole) || (meta.role as UserRole) || 'technician',
        subscriptionTier: profile?.subscription_tier as SubscriptionTier | null,
        subscriptionStatus: profile?.subscription_status,
      };
      setUser(next);
      setRoleState(next.role);
      try { localStorage.setItem(USER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    }
    return {};
  }, []);

  const signUpWithPassword = useCallback(async (
    email: string,
    password: string,
    name: string,
    r: UserRole,
  ): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Auth is not configured' };
    const trimmedEmail = email.trim();
    const trimmedName = name.trim() || trimmedEmail.split('@')[0];
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { data: { name: trimmedName, role: r } },
    });
    if (error) return { error: error.message };

    // If we have a session immediately (email confirmations off), upsert profile
    if (data.user && data.session) {
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: trimmedEmail,
          name: trimmedName,
          role: r,
        }, { onConflict: 'id' });
      } catch { /* ignore — trigger/policy may also handle it */ }

      const next: AuthUser = { id: data.user.id, email: trimmedEmail, name: trimmedName, role: r };
      setUser(next);
      setRoleState(r);
      try { localStorage.setItem(USER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return {};
    }

    // Email confirmation required — no session yet
    if (data.user && !data.session) {
      return { error: 'Check your email to confirm your account, then sign in.' };
    }
    return {};
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) {
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
    }
    setUser(null);
    try { localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !user?.id) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id,email,name,role,subscription_tier,subscription_status')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile) return;
    const next: AuthUser = {
      id: profile.id,
      email: profile.email || user.email,
      name: profile.name || user.name,
      role: (profile.role as UserRole) || user.role,
      subscriptionTier: profile.subscription_tier as SubscriptionTier | null,
      subscriptionStatus: profile.subscription_status,
    };
    setUser(next);
    setRoleState(next.role);
    try { localStorage.setItem(USER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setAuthVersion(v => v + 1);
  }, [user?.id, user?.email, user?.name, user?.role]);

  const userName = user?.name || (role === 'management' ? 'S. Williams' : role === 'lead' ? 'M. Rodriguez' : 'T. Patel');

  return (
    <AppContext.Provider
      value={{
        sidebarOpen,
        toggleSidebar,
        activeEquipment,
        setActiveEquipment,
        appliedCrossFix,
        applyCrossFix,
        clearAppliedCrossFix,
        role,
        setRole,
        userName,
        isAuthenticated: !!user,
        user,
        authLoading,
        authVersion,
        signInLocal,
        signInWithPassword,
        signUpWithPassword,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
