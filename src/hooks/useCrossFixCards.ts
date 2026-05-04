import { useCallback, useEffect, useState } from 'react';
import { supabase, hasSupabase } from '@/lib/supabase';
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
        data.map((d: any) => ({
          ...d,
          parts: Array.isArray(d.parts) ? d.parts : [],
          tags: Array.isArray(d.tags) ? d.tags : [],
        })) as CrossFixCard[],
      );
    } else {
      setCards(mockToCards());
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!hasSupabase || !supabase) return;

    // Realtime subscription — every plant sees inserts/updates instantly
    const channel = supabase
      .channel('cross_fix_cards_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cross_fix_cards' },
        (payload: any) => {
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
              return prev.filter((c) => c.id !== (payload.old as any).id);
            }
            return prev;
          });
        },
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const submit = useCallback(
    async (draft: NewCrossFixCard) => {
      const autoApprove = draft.author_role === 'lead' || draft.author_role === 'management';
      const status = autoApprove ? 'approved' : 'pending';
      const code = `CFX-${Date.now().toString().slice(-4)}`;

      if (hasSupabase && supabase) {
        const { data, error } = await supabase
          .from('cross_fix_cards')
          .insert({
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
        await supabase
          .from('cross_fix_cards')
          .update({ status: 'approved', approved_by: approver, approved_at: new Date().toISOString() })
          .eq('id', id);
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
        const row = cards.find((c) => c.id === id);
        if (row) {
          await supabase.from('cross_fix_cards').update({ helpful: row.helpful + 1 }).eq('id', id);
        }
      }
    },
    [cards],
  );

  return { cards, loading, live, refresh, submit, approve, upvote };
}
