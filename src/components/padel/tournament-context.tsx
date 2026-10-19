import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Json } from '@/integrations/supabase/types';
import { initialState, type TournamentState } from '@/lib/padel/tournament';
import { TournamentContext } from './use-tournament';
export function TournamentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState); const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false); const [dirty, setDirty] = useState(false); const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    async function load(current: User | null) {
      if (!active) return; setUser(current);
      if (!current) return;
      setBusy(true);
      const { data, error } = await supabase.from('padel_tournaments').select('state').eq('owner_id', current.id).maybeSingle();
      if (!active) return;
      if (error) setNotice('Le tournoi enregistré ne peut pas être chargé. Réessayez avant de sauvegarder.');
      else if (data) { const saved = data.state as unknown as TournamentState; if (Array.isArray(saved.teams) && saved.draw && saved.results) { setState(saved); setDirty(false); } }
      setBusy(false);
    }
    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') setTimeout(() => { supabase.auth.getUser().then(({ data }) => load(data.user)); }, 0);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  const update = (next: TournamentState) => { setState(next); setDirty(true); setNotice(''); };
  async function save() {
    if (!user || busy) return;
    setBusy(true);
    const { error } = await supabase.from('padel_tournaments').upsert({ owner_id: user.id, state: state as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
    setBusy(false); if (error) setNotice('Sauvegarde impossible. Vos modifications restent affichées ; réessayez.');
    else { setDirty(false); setNotice('Tournoi enregistré.'); }
  }
  return <TournamentContext.Provider value={{ state, update, user, busy, dirty, notice, save }}>{children}</TournamentContext.Provider>;
}