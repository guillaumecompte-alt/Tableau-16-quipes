import type { TournamentState, Team } from './tournament';

export type TournamentBackup = {
  format: 'ze-padel-tournament-backup';
  version: 1;
  savedAt: string;
  state: TournamentState;
};

const BACKUP_FORMAT = 'ze-padel-tournament-backup';
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isTournamentState(value: unknown): value is TournamentState {
  if (!isRecord(value) || !Array.isArray(value.teams) || value.teams.length !== 16) return false;
  if (!isRecord(value.draw) || !isRecord(value.results)) return false;

  const ranks = new Set<number>();
  for (const item of value.teams) {
    if (!isRecord(item)) return false;
    const team = item as unknown as Team;
    if (!Number.isInteger(team.rank) || team.rank < 1 || team.rank > 16 || ranks.has(team.rank)) return false;
    ranks.add(team.rank);
    if (typeof team.player1 !== 'string' || typeof team.player2 !== 'string') return false;
    if (!(typeof team.ranking1 === 'string' || typeof team.ranking1 === 'number')) return false;
    if (!(typeof team.ranking2 === 'string' || typeof team.ranking2 === 'number')) return false;
    if (typeof team.time !== 'string') return false;
  }
  for (const value of Object.values(value.draw)) {
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 16) return false;
  }
  for (const [matchId, result] of Object.entries(value.results)) {
    if (!/^(?:[1-9]|1\d|2[0-8])$/.test(matchId) || (result !== 0 && result !== 1)) return false;
  }
  return true;
}

export function createTournamentBackup(state: TournamentState, savedAt = new Date().toISOString()): TournamentBackup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, savedAt, state };
}

export function serializeTournamentBackup(state: TournamentState): string {
  return JSON.stringify(createTournamentBackup(state), null, 2);
}

export function parseTournamentBackup(text: string): TournamentBackup {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) {
    throw new Error('Le fichier de sauvegarde dépasse la taille maximale de 5 Mo.');
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('Ce fichier ne contient pas un JSON valide.');
  }
  if (!isRecord(value) || value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) {
    throw new Error('Ce fichier n’est pas une sauvegarde ZE PADEL reconnue.');
  }
  if (typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt))) {
    throw new Error('La date de sauvegarde est absente ou invalide.');
  }
  if (!isTournamentState(value.state)) {
    throw new Error('La sauvegarde ne contient pas une liste valide de 16 équipes et son tirage.');
  }
  return value as unknown as TournamentBackup;
}

function localStorageKey(ownerId: string | null): string {
  return `ze-padel:tournament-backup:v1:${ownerId ?? 'guest'}`;
}

export function readLocalTournamentBackup(ownerId: string | null): TournamentBackup | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(localStorageKey(ownerId));
    if (!value) return null;
    return parseTournamentBackup(value);
  } catch {
    return null;
  }
}

export function writeLocalTournamentBackup(
  ownerId: string | null,
  state: TournamentState,
  savedAt = new Date().toISOString(),
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(localStorageKey(ownerId), JSON.stringify(createTournamentBackup(state, savedAt)));
    return true;
  } catch {
    // The downloadable JSON backup remains available if browser storage is unavailable or full.
    return false;
  }
}
