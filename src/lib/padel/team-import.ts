import { initialState, type Team, type TournamentState } from './tournament';

const columns = {
  rank: 'position de la paire', player1: 'nom joueur 1', first1: 'prenom joueur 1',
  ranking1: 'classement joueur 1', email1: 'mail joueur 1', player2: 'nom joueur 2', first2: 'prenom joueur 2', ranking2: 'classement joueur 2', email2: 'mail joueur 2',
};
const text = (value: unknown) => String(value ?? '').trim();
const normalize = (value: unknown) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
const integer = (value: unknown) => Number(text(value).replace(/[\s\u00a0\u202f]/g, ''));

export function parseParticipantRows(rows: unknown[][]): Team[] {
  const headerIndex = rows.findIndex(row => row.some(cell => normalize(cell) === columns.rank));
  const header = rows[headerIndex];
  if (!header) throw new Error('Colonne « Position de la paire » introuvable. Sélectionnez une liste de participants.');
  const indexes = Object.fromEntries(Object.entries(columns).map(([key, name]) => [key, header.findIndex(cell => normalize(cell) === name)]));
  for (const key of ['rank', 'player1', 'ranking1', 'player2', 'ranking2']) {
    if ((indexes[key] ?? -1) < 0) throw new Error(`Colonne « ${columns[key as keyof typeof columns]} » introuvable.`);
  }
  const teams: Team[] = [];
  const ranks = new Set<number>();
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(cell => !text(cell))) continue;
    const get = (key: string) => { const index = indexes[key]; return index === undefined || index < 0 ? '' : row[index]; };
    if (normalize(get('rank')) === columns.rank) continue;
    if (!text(get('rank')) && ['player1', 'first1', 'player2', 'first2'].every(key => !text(get(key)))) continue;
    const rank = integer(get('rank'));
    if (!Number.isInteger(rank) || rank < 1 || rank > 16) throw new Error(`Ligne ${i + 1} : le rang doit être compris entre 1 et 16.`);
    if (ranks.has(rank)) throw new Error(`Le rang ${rank} apparaît plusieurs fois.`);
    const surname1 = text(get('player1')); const surname2 = text(get('player2'));
    if (!surname1 || !surname2) throw new Error(`Rang ${rank} : le nom de chaque joueur est obligatoire.`);
    const ranking1 = integer(get('ranking1')); const ranking2 = integer(get('ranking2'));
    if (![ranking1, ranking2].every(n => Number.isInteger(n) && n > 0)) throw new Error(`Rang ${rank} : les deux classements doivent être des nombres entiers positifs.`);
    ranks.add(rank);
    teams.push({ rank, player1: [surname1.toUpperCase(), text(get('first1'))].filter(Boolean).join(' '), player2: [surname2.toUpperCase(), text(get('first2'))].filter(Boolean).join(' '), ranking1, ranking2, email1: text(get('email1')), email2: text(get('email2')), time: '' });
  }
  if (!teams.length) throw new Error('Aucune paire trouvée dans ce fichier.');
  return teams.sort((a, b) => a.rank - b.rank);
}

export function importedTournament(teams: Team[]): TournamentState {
  return { ...initialState(), teams: Array.from({ length: 16 }, (_, i) => teams.find(t => t.rank === i + 1) ?? { rank: i + 1, player1: '', player2: '', ranking1: '', ranking2: '', email1: '', email2: '', time: '' }) };
}