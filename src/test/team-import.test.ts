import { describe, expect, it } from 'vitest';
import { importedTournament, parseParticipantRows } from '@/lib/padel/team-import';
import { canDraw, drawAll, initialState, resolveSource } from '@/lib/padel/tournament';

const header = ['Nom de l’épreuve', 'Catégorie de l’épreuve', 'Position de la paire', 'Nom joueur 1', 'Prénom joueur 1', 'Date de naissance joueur 1', 'Licence joueur 1', 'Club joueur 1', 'Classement joueur 1', 'Mail joueur 1', 'Téléphone joueur 1', 'Nom joueur 2', 'Prénom joueur 2', 'Date de naissance joueur 2', 'Licence joueur 2', 'Club joueur 2', 'Classement joueur 2', 'Mail joueur 2', 'Téléphone joueur 2', 'Poids paire'];
const row = ['', '', 1, 'JEKAL', 'Florent', '', '', '', 15709, 'private@example.test', '', 'POUCHAIN', 'Julien', '', '', '', 14401, '', '', 30110];
describe('Participant Excel import', () => {
  it('maps C, D/E, I, L/M and Q while excluding private fields', () => {
    expect(parseParticipantRows([header, row])).toEqual([{ rank: 1, player1: 'JEKAL Florent', player2: 'POUCHAIN Julien', ranking1: 15709, ranking2: 14401, time: '' }]);
  });
  it('leaves eight empty pairs when eight are imported, not old sample teams', () => {
    const imported = parseParticipantRows([header, ...Array.from({ length: 8 }, (_, i) => row.map((cell, j) => j === 2 ? i + 1 : cell))]);
    const state = importedTournament(imported);
    expect(state.teams).toHaveLength(16);
    expect(state.teams.slice(8).every(t => t.player1 === '' && t.player2 === '')).toBe(true);
    expect(canDraw(state)).toBe(false);
    expect(drawAll(state)).toEqual(state);
  });
  it('resets results and draw to the two automatic seeds', () => {
    const state = importedTournament(parseParticipantRows([header, row]));
    expect(state.results).toEqual({}); expect(state.draw).toEqual({ L4: 2, L30: 1 });
    expect(resolveSource(state, { slot: 'L4' })).toBeUndefined();
  });
  it('allows a draw once all sixteen pairs are completed', () => {
    expect(canDraw(importedTournament(initialState().teams))).toBe(true);
  });
  it('rejects duplicate ranks', () => { expect(() => parseParticipantRows([header, row, row])).toThrow('plusieurs fois'); });
  it.each([0, 17, 1.5])('rejects rank %s outside the sixteen integer positions', rank => {
    expect(() => parseParticipantRows([header, row.map((cell, i) => i === 2 ? rank : cell)])).toThrow('entre 1 et 16');
  });
  it('rejects missing player names', () => { expect(() => parseParticipantRows([header, row.map((cell, i) => i === 11 ? '' : cell)])).toThrow('nom'); });
  it('rejects invalid rankings', () => { expect(() => parseParticipantRows([header, row.map((cell, i) => i === 8 ? 'abc' : cell)])).toThrow('classements'); });
  it('rejects a missing required column', () => { expect(() => parseParticipantRows([header.map((cell, i) => i === 16 ? '' : cell), row])).toThrow('classement joueur 2'); });
  it('ignores blank and repeated header rows', () => { expect(parseParticipantRows([[], header, row, [], header])).toHaveLength(1); });
  it('imports all sixteen pairs despite the orphan ranking 131754 on line 18', () => {
    const participants = Array.from({ length: 16 }, (_, i) => row.map((cell, j) => j === 2 ? i + 1 : cell));
    const trailingRow = Array.from({ length: 20 }, (_, i) => i === 16 ? 131754 : '');
    expect(parseParticipantRows([header, ...participants, trailingRow]).map(team => team.rank)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
  it('still rejects a participant with names but no pair rank', () => {
    expect(() => parseParticipantRows([header, row.map((cell, i) => i === 2 ? '' : cell)])).toThrow('entre 1 et 16');
  });
});