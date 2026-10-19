import { describe, expect, it } from 'vitest';
import { initialState } from './tournament';
import { parseTournamentBackup, serializeTournamentBackup } from './local-backup';

describe('Tournament backup restoration', () => {
  it('accepts and round-trips a complete 16-team draw', () => {
    const state = initialState();
    state.draw = {
      L4: 2, L30: 1, L12: 4, L22: 3,
      G4: 8, G12: 7, G22: 6, G30: 5,
      B4: 11, B12: 10, B22: 12, B30: 9,
      B6: 14, B14: 15, B20: 16, B28: 13,
    };

    const restored = parseTournamentBackup(serializeTournamentBackup(state));

    expect(restored.state.teams).toHaveLength(16);
    expect(restored.state.draw).toEqual(state.draw);
    expect(restored.state.results).toEqual({});
  });
});
