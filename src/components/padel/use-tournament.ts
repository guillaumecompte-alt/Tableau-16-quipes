import { createContext, useContext } from 'react';
import type { User } from '@supabase/supabase-js';
import type { TournamentState } from '@/lib/padel/tournament';

type TournamentContextValue = {
  state: TournamentState;
  update: (state: TournamentState) => void;
  user: User | null;
  busy: boolean;
  dirty: boolean;
  notice: string;
  save: () => Promise<void>;
};

// Keep context identity outside the refreshable provider component module.
export const TournamentContext = createContext<TournamentContextValue | null>(null);

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) throw new Error('TournamentProvider missing');
  return context;
}