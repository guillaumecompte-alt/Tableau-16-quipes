import { createContext, useContext } from 'react';
import type { TournamentState } from '@/lib/padel/tournament';

type TournamentContextValue = {
  state: TournamentState;
  update: (state: TournamentState) => void;
  busy: boolean;
  dirty: boolean;
  notice: string;
  restoreState: (state: TournamentState) => Promise<{ localSaved: boolean }>;
  localBackupReady: boolean;
};

// Keep context identity outside the refreshable provider component module.
export const TournamentContext = createContext<TournamentContextValue | null>(null);

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) throw new Error('TournamentProvider missing');
  return context;
}
