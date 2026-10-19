import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Json } from '@/integrations/supabase/types';
import { initialState, type TournamentState } from '@/lib/padel/tournament';
import { readLocalTournamentBackup, isTournamentState, writeLocalTournamentBackup } from '@/lib/padel/local-backup';
import { TournamentContext } from './use-tournament';

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const [localBackupReady, setLocalBackupReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function load(current: User | null) {
      if (!active) return;
      setUser(current);
      setBusy(true);
      setNotice('');

      const ownerId = current?.id ?? null;
      const local = readLocalTournamentBackup(ownerId);

      if (!current) {
        const guestState = local?.state ?? initialState();
        setState(guestState);
        setDirty(false);
        setLocalBackupReady(writeLocalTournamentBackup(null, guestState, local?.savedAt));
        if (local) {
          setNotice('La dernière sauvegarde locale de ce navigateur a été restaurée automatiquement.');
        }
        setBusy(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('padel_tournaments')
          .select('state, updated_at')
          .eq('owner_id', current.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          if (local) {
            setState(local.state);
            setDirty(true);
            setNotice('Connexion à la sauvegarde en ligne impossible. La copie locale a été récupérée ; elle reste disponible sur ce PC.');
            setLocalBackupReady(true);
          } else {
            setNotice('Le tournoi enregistré ne peut pas être chargé. Réessayez avant de modifier ou de sauvegarder.');
            setLocalBackupReady(false);
          }
          setBusy(false);
          return;
        }

        if (data && isTournamentState(data.state)) {
          const cloudSavedAt = typeof data.updated_at === 'string' && Number.isFinite(Date.parse(data.updated_at))
            ? data.updated_at
            : '1970-01-01T00:00:00.000Z';
          const localIsNewer = Boolean(local && Date.parse(local.savedAt) > Date.parse(cloudSavedAt));

          if (localIsNewer && local) {
            setState(local.state);
            setDirty(true);
            setLocalBackupReady(true);
            setNotice('Une sauvegarde locale plus récente a été récupérée. Clique sur « Enregistrer en ligne » pour la synchroniser.');
          } else {
            setState(data.state);
            setDirty(false);
            setLocalBackupReady(writeLocalTournamentBackup(current.id, data.state, cloudSavedAt));
          }
        } else if (local) {
          setState(local.state);
          setDirty(true);
          setLocalBackupReady(true);
          setNotice('La copie locale du tournoi a été récupérée. Vérifie-la puis clique sur « Enregistrer en ligne ».');
        } else if (!data) {
          const freshState = initialState();
          setState(freshState);
          setDirty(false);
          setLocalBackupReady(writeLocalTournamentBackup(current.id, freshState));
        } else {
          setLocalBackupReady(false);
          setNotice('Les données en ligne ne sont pas reconnues. Une sauvegarde locale ou un fichier de secours peut être restauré.');
        }
        setBusy(false);
      } catch {
        if (!active) return;
        if (local) {
          setState(local.state);
          setDirty(true);
          setLocalBackupReady(true);
          setNotice('La sauvegarde en ligne est indisponible. La copie locale a été récupérée ; tu pourras la synchroniser quand la connexion reviendra.');
        } else {
          setLocalBackupReady(false);
          setNotice('Impossible de charger le tournoi. Si tu as un fichier de sauvegarde, restaure-le depuis la barre du haut.');
        }
        setBusy(false);
      }
    }

    supabase.auth.getUser().then(({ data }) => load(data.user)).catch(() => load(null));
    const { data: listener } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setTimeout(() => {
          supabase.auth.getUser().then(({ data }) => load(data.user)).catch(() => load(null));
        }, 0);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const update = (next: TournamentState) => {
    setState(next);
    setDirty(true);
    const localSaved = writeLocalTournamentBackup(user?.id ?? null, next);
    setLocalBackupReady(localSaved);
    setNotice(localSaved ? '' : 'La sauvegarde automatique du navigateur est indisponible. Télécharge une copie JSON sur le PC pour sécuriser le tournoi.');
  };

  async function restoreState(next: TournamentState): Promise<{ localSaved: boolean; onlineSaved: boolean }> {
    const savedAt = new Date().toISOString();
    setState(next);
    setDirty(true);
    const localSaved = writeLocalTournamentBackup(user?.id ?? null, next, savedAt);
    setLocalBackupReady(localSaved);
    setNotice(localSaved ? '' : 'La restauration est affichée, mais la copie locale n’a pas pu être écrite.');

    if (!user) {
      setNotice(localSaved
        ? 'Sauvegarde restaurée sur ce PC. Connecte-toi puis enregistre en ligne pour la synchroniser.'
        : 'Sauvegarde restaurée à l’écran, mais impossible de la conserver dans le navigateur. Télécharge immédiatement une copie JSON.');
      return { localSaved, onlineSaved: false };
    }

    setBusy(true);
    try {
      const { error } = await supabase.from('padel_tournaments').upsert({
        owner_id: user.id,
        state: next as unknown as Json,
        updated_at: savedAt,
      }, { onConflict: 'owner_id' });

      if (error) {
        setDirty(true);
        setNotice(localSaved
          ? 'Sauvegarde restaurée localement, mais la synchronisation en ligne a échoué. Vérifie la connexion puis réessaie « Enregistrer en ligne ».'
          : 'La restauration est affichée, mais la conservation locale et la sauvegarde en ligne ont échoué. Télécharge une copie JSON immédiatement.');
        return { localSaved, onlineSaved: false };
      }

      setDirty(false);
      const mirrored = writeLocalTournamentBackup(user.id, next, savedAt);
      setLocalBackupReady(mirrored);
      setNotice('Sauvegarde restaurée et enregistrée en ligne' + (mirrored ? ' et sur ce PC.' : '. Attention : la copie locale n’a pas pu être écrite.'));
      return { localSaved: localSaved || mirrored, onlineSaved: true };
    } catch {
      setDirty(true);
      setNotice(localSaved
        ? 'Sauvegarde restaurée localement, mais la connexion à Supabase a échoué. Réessaie « Enregistrer en ligne ».'
        : 'La restauration est affichée, mais elle n’a pas pu être conservée. Télécharge une copie JSON immédiatement.');
      return { localSaved, onlineSaved: false };
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const savedAt = new Date().toISOString();
      const { error } = await supabase.from('padel_tournaments').upsert({
        owner_id: user.id,
        state: state as unknown as Json,
        updated_at: savedAt,
      }, { onConflict: 'owner_id' });

      if (error) {
        setNotice('Sauvegarde en ligne impossible. La copie locale reste disponible ; réessaie quand la connexion sera rétablie.');
      } else {
        setDirty(false);
        setLocalBackupReady(writeLocalTournamentBackup(user.id, state, savedAt));
        setNotice('Tournoi enregistré en ligne et copié sur ce PC.');
      }
    } catch {
      setNotice('Sauvegarde en ligne impossible. La copie locale reste disponible ; réessaie quand la connexion sera rétablie.');
    } finally {
      setBusy(false);
    }
  }

  return <TournamentContext.Provider value={{ state, update, user, busy, dirty, notice, save, restoreState, localBackupReady }}>
    {children}
  </TournamentContext.Provider>;
}
