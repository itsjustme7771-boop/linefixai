import { useCallback, useEffect, useState } from 'react';
import { supabase, hasSupabase, requireLineFixActor } from '@/lib/supabase';
import { crossFixCards as mockCards } from '@/data/mockData';

export interface CrossFixCard {
  id: string;
  code: string | null;
  title: string;
  equipment_id: string | null;
  equipment_name: string | null;
  plant: string | null;
  author: string | null;
  author_role: string | null;
  time_to_fix: string | null;
  symptoms: string | null;
  root_cause: string | null;
  solution: string | null;
  parts: string[];
  tags: string[];
  status: 'pending' | 'approved' | 'rejected';
  helpful: number;
  source_session_id?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
}

export interface NewCrossFixCard {
  title: string;
  equipment_id?: string | null;
  equipment_name?: string | null;
  plant?: string | null;
  author: string;
  author_role: 'technician' | 'lead' | 'management';
  time_to_fix?: string;
  symptoms?: string;
  root_cause?: string;
  solution?: string;
  parts?: string[];
  tags?: string[];
  source_session_id?: string | null;
}

// Adapt mock data shape -> CrossFixCard (for demo-mode fallback)
function mockToCards(): CrossFixCard[] {
  return mockCards.map((c, i) => ({
    id: `mock-${i}`,
    code: c.id,
    title: c.title,
    equipment_id: null,
    equipment_name: c.equipment,
    plant: c.plant,
    author: c.author,
    author_role: null,
    time_to_fix: c.timeToFix,
    symptoms: c.symptoms,
    root_cause: c.rootCause,
    solution: c.solution,
    parts: c.parts,
    tags: c.tags,
    status: 'approved',
    helpful: c.helpful,
    created_at: c.date,
  }));
}

export function useCrossFixCards() {
  const [cards, setCards] = useState<CrossFixCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);

  const refresh = useCallback(async () => {
    if (!hasSupabase || !supabase) {
      setCards(mockToCards());
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('cross_fix_cards')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setLoading(false);
    if (!error && data) {
      setCards(
        data.map((d) => ({
          ...d,
          parts: Array.isArray(d.parts) ? d.parts : [],
          tags: Array.isArray(d.tags) ? d.tags : [],
        })) as CrossFixCard[],
      );
    } else {
      // A configured production backend must fail closed. Never replace an
      // authorization or network error with donor/demo records.
      setCards([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!hasSupabase || !supabase) return;

    // Realtime subscription — every plant sees inserts/updates instantly
    const channel = supabase
      .channel(`cross_fix_cards_live:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cross_fix_cards' },
        (payload) => {
          setCards((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as CrossFixCard;
              if (prev.find((c) => c.id === row.id)) return prev;
              return [
                { ...row, parts: row.parts ?? [], tags: row.tags ?? [] },
                ...prev,
              ];
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as CrossFixCard;
              return prev.map((c) =>
                c.id === row.id ? { ...row, parts: row.parts ?? [], tags: row.tags ?? [] } : c,
              );
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((c) => c.id !== (payload.old as { id?: string }).id);
            }
            return prev;
          });
        },
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));

    const { data: authSubscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setCards([]);
        setLive(false);
        return;
      }

      void refresh();
    });

    return () => {
      supabase.removeChannel(channel);
      authSubscription.subscription.unsubscribe();
    };
  }, [refresh]);

  const submit = useCallback(
    async (draft: NewCrossFixCard) => {
      const autoApprove = false;
      const status = 'pending';
      const code = `CFX-${Date.now().toString().slice(-4)}`;

      if (hasSupabase && supabase) {
        const actor = await requireLineFixActor();
        const { data, error } = await supabase
          .from('cross_fix_cards')
          .insert({
            organization_id: actor.organizationId,
            created_by: actor.userId,
            code,
            title: draft.title,
            equipment_id: draft.equipment_id || 'Unspecified equipment',
            equipment_name: draft.equipment_name || 'Unspecified equipment',
            plant: draft.plant || 'Unspecified plant',
            author: draft.author,
            author_role: draft.author_role,
            time_to_fix: draft.time_to_fix || '',
            symptoms: draft.symptoms || '',
            root_cause: draft.root_cause || '',
            solution: draft.solution || 'Resolution recorded by technician',
            parts: draft.parts ?? [],
            tags: draft.tags ?? [],
            status,
            helpful: 0,
            source_session_id: draft.source_session_id ?? null,
            approved_by: null,
            approved_at: null,
          })
          .select()
          .single();
        if (error) throw error;
        return { card: data as CrossFixCard, autoApproved: autoApprove };
      }

      // Local fallback
      const local: CrossFixCard = {
        id: `local-${Date.now()}`,
        code,
        title: draft.title,
        equipment_id: draft.equipment_id ?? null,
        equipment_name: draft.equipment_name ?? null,
        plant: draft.plant ?? null,
        author: draft.author,
        author_role: draft.author_role,
        time_to_fix: draft.time_to_fix ?? null,
        symptoms: draft.symptoms ?? null,
        root_cause: draft.root_cause ?? null,
        solution: draft.solution ?? null,
        parts: draft.parts ?? [],
        tags: draft.tags ?? [],
        status,
        helpful: 0,
        source_session_id: draft.source_session_id ?? null,
        approved_by: autoApprove ? draft.author : null,
        approved_at: autoApprove ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
      };
      setCards((prev) => [local, ...prev]);
      return { card: local, autoApproved: autoApprove };
    },
    [],
  );

  const approve = useCallback(
    async (id: string, approver: string) => {
      if (hasSupabase && supabase) {
        const { error } = await supabase.rpc('review_cross_fix_card', {
          card_id: id,
          new_status: 'approved',
        });
        if (error) throw error;
      } else {
        setCards((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, status: 'approved', approved_by: approver, approved_at: new Date().toISOString() } : c,
          ),
        );
      }
    },
    [],
  );

  const upvote = useCallback(
    async (id: string) => {
      // optimistic
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, helpful: c.helpful + 1 } : c)));
      if (hasSupabase && supabase) {
        const { error } = await supabase.rpc('increment_cross_fix_helpful', { card_id: id });
        if (error) {
          setCards((prev) => prev.map((c) => (c.id === id ? { ...c, helpful: Math.max(0, c.helpful - 1) } : c)));
          throw error;
        }
      }
    },
    [],
  );

  return { cards, loading, live, refresh, submit, approve, upvote };
}
