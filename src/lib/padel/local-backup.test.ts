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
    expect(restored.state.info).toEqual({ tournamentType: '', date: '', referee: '' });
  });

  it('persists tournament information in a backup', () => {
    const state = initialState();
    state.info = { tournamentType: 'P50', date: '2026-11-14', referee: 'Camille Martin' };
    const restored = parseTournamentBackup(serializeTournamentBackup(state));
    expect(restored.state.info).toEqual(state.info);
  });

  it('accepts an older backup without tournament information', () => {
    const state = initialState();
    const legacy = { ...state } as Partial<typeof state>;
    delete legacy.info;
    const restored = parseTournamentBackup(serializeTournamentBackup(legacy as typeof state));
    expect(restored.state.info).toBeUndefined();
  });
});
