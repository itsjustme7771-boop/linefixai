import { useCallback, useEffect, useState } from 'react';
import { supabase, hasSupabase } from '@/lib/supabase';

export interface DiagnosticSession {
  id: string;
  issue: string;
  equipment_id?: string | null;
  response: string;
  outcome?: 'fixed' | 'refine' | null;
  created_at: string;
}

const LOCAL_KEY = 'mttr.diagnostic_sessions';

function loadLocal(): DiagnosticSession[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DiagnosticSession[];
  } catch {
    return [];
  }
}

function saveLocal(sessions: DiagnosticSession[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(sessions.slice(0, 50)));
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Persists diagnostic sessions. Uses Supabase when configured (table:
 * `diagnostic_sessions`), otherwise falls back to localStorage so the history
 * panel still works in development.
 */
export function useDiagnosticSessions() {
  const [sessions, setSessions] = useState<DiagnosticSession[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (hasSupabase && supabase) {
      setLoading(true);
      const { data, error } = await supabase
        .from('diagnostic_sessions')
        .select('id, issue, equipment_id, response, outcome, created_at')
        .order('created_at', { ascending: false })
        .limit(25);
      setLoading(false);
      if (!error && data) {
        setSessions(data as DiagnosticSession[]);
        return;
      }
    }
    setSessions(loadLocal());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (s: Omit<DiagnosticSession, 'id' | 'created_at'> & { id?: string }) => {
      const now = new Date().toISOString();
      const localRecord: DiagnosticSession = {
        id: s.id || crypto.randomUUID(),
        issue: s.issue,
        equipment_id: s.equipment_id ?? null,
        response: s.response,
        outcome: s.outcome ?? null,
        created_at: now,
      };

      if (hasSupabase && supabase) {
        // Edge function usually inserts the row and returns the id via header;
        // if the caller already has a server-side id, upsert the outcome only.
        if (s.id) {
          await supabase
            .from('diagnostic_sessions')
            .update({ outcome: s.outcome })
            .eq('id', s.id);
        } else {
          const { data } = await supabase
            .from('diagnostic_sessions')
            .insert({
              issue: s.issue,
              equipment_id: s.equipment_id,
              response: s.response,
              outcome: s.outcome,
            })
            .select()
            .single();
          if (data) localRecord.id = (data as DiagnosticSession).id;
        }
      } else {
        const next = [localRecord, ...loadLocal().filter(x => x.id !== localRecord.id)];
        saveLocal(next);
      }

      await refresh();
      return localRecord;
    },
    [refresh],
  );

  const updateOutcome = useCallback(
    async (id: string, outcome: 'fixed' | 'refine') => {
      if (hasSupabase && supabase) {
        await supabase.from('diagnostic_sessions').update({ outcome }).eq('id', id);
      } else {
        const next = loadLocal().map(s => (s.id === id ? { ...s, outcome } : s));
        saveLocal(next);
      }
      await refresh();
    },
    [refresh],
  );

  return { sessions, loading, refresh, save, updateOutcome };
}
