import { useEffect, useState, type ReactNode } from 'react';
import { initialState, type TournamentState } from '@/lib/padel/tournament';
import { readLocalTournamentBackup, writeLocalTournamentBackup } from '@/lib/padel/local-backup';
import { TournamentContext } from './use-tournament';

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const [localBackupReady, setLocalBackupReady] = useState(false);

  useEffect(() => {
    let active = true;

    try {
      // The desktop build stores everything in this PC's private Electron browser profile.
      const local = readLocalTournamentBackup(null);
      const loadedState = local?.state ?? initialState();
      const saved = writeLocalTournamentBackup(null, loadedState, local?.savedAt);

      if (!active) return;
      setState(loadedState);
      setLocalBackupReady(saved);
      setDirty(!saved);
      setNotice(local
        ? 'La sauvegarde locale de ce PC a été récupérée automatiquement.'
        : saved
          ? 'ZE PADEL fonctionne en local. Les modifications sont enregistrées sur ce PC.'
          : 'La sauvegarde automatique locale est indisponible. Utilise « Copie sur PC » pour créer un fichier de secours.');
    } catch {
      if (active) {
        setLocalBackupReady(false);
        setDirty(true);
        setNotice('Impossible de lire la sauvegarde locale. Tu peux récupérer un fichier JSON avec « Restaurer ».');
      }
    } finally {
      if (active) setBusy(false);
    }

    return () => {
      active = false;
    };
  }, []);

  function update(next: TournamentState) {
    setState(next);
    const saved = writeLocalTournamentBackup(null, next);
    setLocalBackupReady(saved);
    setDirty(!saved);
    setNotice(saved
      ? 'Modifications enregistrées automatiquement sur ce PC.'
      : 'La sauvegarde automatique locale a échoué. Télécharge une copie JSON pour sécuriser ce tournoi.');
  }

  async function restoreState(next: TournamentState): Promise<{ localSaved: boolean }> {
    setBusy(true);
    setState(next);
    const saved = writeLocalTournamentBackup(null, next);
    setLocalBackupReady(saved);
    setDirty(!saved);
    setNotice(saved
      ? 'Sauvegarde restaurée et conservée sur ce PC. Aucune connexion n’est nécessaire.'
      : 'Sauvegarde affichée, mais sa conservation automatique a échoué. Télécharge immédiatement une copie JSON.');
    setBusy(false);
    return { localSaved: saved };
  }

  return (
    <TournamentContext.Provider value={{ state, update, busy, dirty, notice, restoreState, localBackupReady }}>
      {children}
    </TournamentContext.Provider>
  );
}
