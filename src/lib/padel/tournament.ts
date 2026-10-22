import importedTeams from './teams.json';

export type Team = { rank: number; player1: string; player2: string; ranking1: number | string; ranking2: number | string; email1?: string; email2?: string; time: string };
export type Result = 0 | 1;
export type TournamentInfo = { tournamentType: string; date: string; referee: string };
export type TournamentState = { teams: Team[]; draw: Record<string, number>; results: Record<string, Result>; info?: TournamentInfo };
export type Source = { slot: string; band?: string } | { match: number; outcome: 'winner' | 'loser' };
export type Match = { id: number; round: string; cell: string; entries: [Source, Source]; places?: [number, number] };
const slot = (name: string, band?: string): Source => band ? { slot: name, band } : { slot: name };
const win = (match: number): Source => ({ match, outcome: 'winner' });
const lose = (match: number): Source => ({ match, outcome: 'loser' });
export const bands: Record<string, { ranks: number[]; slots: string[] }> = {
  '3–4': { ranks: [3, 4], slots: ['L12', 'L22'] },
  '5–8': { ranks: [5, 6, 7, 8], slots: ['G4', 'G12', 'G22', 'G30'] },
  '9–12': { ranks: [9, 10, 11, 12], slots: ['B4', 'B12', 'B22', 'B30'] },
  '13–16': { ranks: [13, 14, 15, 16], slots: ['B6', 'B14', 'B20', 'B28'] },
};
export const matches: Match[] = [
  { id: 1, round: '1er tour', cell: 'C4', entries: [slot('B4', '9–12'), slot('B6', '13–16')] },
  { id: 2, round: '1er tour', cell: 'C12', entries: [slot('B12', '9–12'), slot('B14', '13–16')] },
  { id: 3, round: '1er tour', cell: 'C20', entries: [slot('B20', '13–16'), slot('B22', '9–12')] },
  { id: 4, round: '1er tour', cell: 'C28', entries: [slot('B28', '13–16'), slot('B30', '9–12')] },
  { id: 5, round: '2e tour', cell: 'H4', entries: [slot('G4', '5–8'), win(1)] },
  { id: 6, round: '2e tour', cell: 'H12', entries: [slot('G12', '5–8'), win(2)] },
  { id: 7, round: '2e tour', cell: 'H20', entries: [win(3), slot('G22', '5–8')] },
  { id: 8, round: '2e tour', cell: 'H28', entries: [win(4), slot('G30', '5–8')] },
  { id: 9, round: 'Places 13–16', cell: 'C34', entries: [lose(1), lose(2)] },
  { id: 10, round: 'Places 13–16', cell: 'C38', entries: [lose(3), lose(4)] },
  { id: 11, round: 'Places 9–12', cell: 'H34', entries: [lose(5), lose(6)] },
  { id: 12, round: 'Places 9–12', cell: 'H38', entries: [lose(7), lose(8)] },
  { id: 13, round: 'Quarts de finale', cell: 'M4', entries: [slot('L4'), win(5)] },
  { id: 14, round: 'Quarts de finale', cell: 'M12', entries: [slot('L12', '3–4'), win(6)] },
  { id: 15, round: 'Quarts de finale', cell: 'M20', entries: [win(7), slot('L22', '3–4')] },
  { id: 16, round: 'Quarts de finale', cell: 'M28', entries: [win(8), slot('L30')] },
  { id: 17, round: '13e / 14e place', cell: 'E36', entries: [win(9), win(10)], places: [13, 14] },
  { id: 18, round: '15e / 16e place', cell: 'E43', entries: [lose(9), lose(10)], places: [15, 16] },
  { id: 19, round: '9e / 10e place', cell: 'J36', entries: [win(11), win(12)], places: [9, 10] },
  { id: 20, round: '11e / 12e place', cell: 'J43', entries: [lose(11), lose(12)], places: [11, 12] },
  { id: 21, round: 'Places 5–8', cell: 'O40', entries: [lose(13), lose(14)] },
  { id: 22, round: 'Places 5–8', cell: 'O44', entries: [lose(15), lose(16)] },
  { id: 23, round: 'Demi-finales', cell: 'O8', entries: [win(13), win(14)] },
  { id: 24, round: 'Demi-finales', cell: 'O24', entries: [win(15), win(16)] },
  { id: 25, round: '7e / 8e place', cell: 'Q49', entries: [lose(21), lose(22)], places: [7, 8] },
  { id: 26, round: '5e / 6e place', cell: 'Q42', entries: [win(21), win(22)], places: [5, 6] },
  { id: 27, round: '3e / 4e place', cell: 'Q35', entries: [lose(23), lose(24)], places: [3, 4] },
  { id: 28, round: 'Finale', cell: 'Q16', entries: [win(23), win(24)], places: [1, 2] },
];
export function initialState(): TournamentState { return { teams: importedTeams, draw: { L4: 2, L30: 1 }, results: {}, info: { tournamentType: '', date: '', referee: '' } }; }
export function isTeamComplete(team: Team): boolean {
  return Boolean(team.player1.trim() && team.player2.trim()) && [team.ranking1, team.ranking2].every(value => Number.isInteger(Number(value)) && Number(value) > 0);
}
export function canDraw(state: TournamentState): boolean {
  return Array.from({ length: 16 }, (_, i) => i + 1).every(rank => state.teams.some(team => team.rank === rank && isTeamComplete(team)));
}
export function drawBand(state: TournamentState, band: string, random = Math.random): TournamentState {
  if (!canDraw(state)) return state;
  const group = bands[band];
  if (!group) return state;
  const shuffled = [...group.ranks];
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); const a = shuffled[i]; const b = shuffled[j]; if (a !== undefined && b !== undefined) { shuffled[i] = b; shuffled[j] = a; } }
  const draw = { ...state.draw };
  group.slots.forEach((s, i) => { const rank = shuffled[i]; if (rank !== undefined) draw[s] = rank; });
  return { ...state, draw, results: {} };
}
export function drawAll(state: TournamentState): TournamentState { return Object.keys(bands).reduce((s, band) => drawBand(s, band), state); }
export function resolveSource(state: TournamentState, source: Source): Team | undefined {
  if ('slot' in source) return state.teams.find(t => t.rank === state.draw[source.slot] && isTeamComplete(t));
  const match = matches.find(m => m.id === source.match);
  const result = state.results[source.match];
  if (!match || result === undefined) return undefined;
  const top = resolveSource(state, match.entries[0]); const bottom = resolveSource(state, match.entries[1]);
  if (!top || !bottom) return undefined;
  return source.outcome === 'winner' ? (result === 1 ? top : bottom) : (result === 1 ? bottom : top);
}
export function setResult(state: TournamentState, id: number, result: Result | undefined): TournamentState {
  const match = matches.find(m => m.id === id);
  if (!match || (result !== undefined && (!resolveSource(state, match.entries[0]) || !resolveSource(state, match.entries[1])))) return state;
  const results = { ...state.results }; delete results[id];
  const descendants = new Set([id]);
  for (const m of matches) if (m.entries.some(s => 'match' in s && descendants.has(s.match))) { descendants.add(m.id); delete results[m.id]; }
  if (result !== undefined) results[id] = result;
  return { ...state, results };
}
export const points = [100, 75, 65, 60, 55, 50, 45, 40, 35, 30, 25, 23, 20, 18, 15, 12];
export function standings(state: TournamentState) {
  const rows: { place: number; team: Team; points: number }[] = [];
  for (const m of matches) if (m.places) {
    const winner = resolveSource(state, win(m.id)); const loser = resolveSource(state, lose(m.id));
    if (winner && loser) { rows.push({ place: m.places[0], team: winner, points: points[m.places[0] - 1] ?? 0 }, { place: m.places[1], team: loser, points: points[m.places[1] - 1] ?? 0 }); }
  }
  return rows.sort((a, b) => a.place - b.place);
}