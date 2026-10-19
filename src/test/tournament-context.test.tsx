import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TournamentProvider } from '@/components/padel/tournament-context';
import { useTournament } from '@/components/padel/use-tournament';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

afterEach(cleanup);

function Editor() {
  const { state, update } = useTournament();
  return <button onClick={() => update({ ...state, results: { 1: 0 } })}>Record result</button>;
}

function Reader() {
  const { state } = useTournament();
  return <output data-testid="result">{state.results[1] ?? 'undecided'}</output>;
}

describe('Tournament context', () => {
  it('shares one context between the root provider and separate consumers', async () => {
    await act(async () => {
      render(<TournamentProvider><Editor /><Reader /></TournamentProvider>);
    });
    expect(screen.getByTestId('result').textContent).toBe('undecided');
    fireEvent.click(screen.getByRole('button', { name: 'Record result' }));
    expect(screen.getByTestId('result').textContent).toBe('0');
  });
});