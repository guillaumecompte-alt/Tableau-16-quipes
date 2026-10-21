import { bands, matches, type Team, type TournamentState } from './tournament';

export type VideoEntry = { label: string; rank?: number; seed: boolean };
export type VideoColumn = { title: string; matches: [VideoEntry, VideoEntry][] };
export type Reveal = { slot: string; band: string; team: Team; seed: boolean };

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const VIDEO_SECONDS = 45;
export const INTRO_END = 3;
export const REVEAL_END = 37;

const seedSlots = ['L30', 'L4'];

export function teamLabel(team: Team) { return team.player1 + ' / ' + team.player2; }

/** True once every one of the 16 bracket slots holds a team. */
export function isDrawComplete(state: TournamentState) {
  return [...seedSlots, ...Object.values(bands).flatMap(b => b.slots)]
    .every(s => state.teams.some(t => t.rank === state.draw[s]));
}

/** The reveal order matches the tournament's seeded-draw phases. */
export function revealSequence(state: TournamentState): Reveal[] {
  const order: [string, string[]][] = [
    ['TS', seedSlots],
    ['13–16', bands['13–16']!.slots],
    ['9–12', bands['9–12']!.slots],
    ['5–8', bands['5–8']!.slots],
    ['3–4', bands['3–4']!.slots],
  ];
  const out: Reveal[] = [];
  for (const [band, slots] of order) {
    for (const slot of slots) {
      const team = state.teams.find(t => t.rank === state.draw[slot]);
      if (team) out.push({ slot, band, team, seed: band === 'TS' });
    }
  }
  return out;
}

/**
 * Builds only the first three tournament columns. During the animation, slots
 * not yet revealed are deliberately blank; the underlying final draw is never
 * shown prematurely.
 */
export function videoColumns(state: TournamentState, visibleSlots?: ReadonlySet<string>): VideoColumn[] {
  const entry = (matchId: number, index: 0 | 1): VideoEntry => {
    const src = matches.find(x => x.id === matchId)!.entries[index];
    if ('match' in src) return { label: 'Vainqueur match ' + src.match, seed: false };
    if (visibleSlots && !visibleSlots.has(src.slot)) return { label: 'À tirer', seed: false };
    const team = state.teams.find(t => t.rank === state.draw[src.slot]);
    return team
      ? { label: teamLabel(team), rank: team.rank, seed: team.rank <= 2 }
      : { label: 'À tirer', seed: false };
  };
  const col = (title: string, ids: number[]): VideoColumn => ({
    title,
    matches: ids.map(id => [entry(id, 0), entry(id, 1)]),
  });
  return [
    col('1er tour', [1, 2, 3, 4]),
    col('2e tour', [5, 6, 7, 8]),
    col('Quarts de finale', [13, 14, 15, 16]),
  ];
}

export function revealTime(index: number, count: number) {
  return INTRO_END + ((REVEAL_END - INTRO_END) / Math.max(count, 1)) * index;
}

/** Prefer genuine MP4/H.264 support, otherwise export WebM honestly. */
export function pickVideoFormat(isSupported: (type: string) => boolean) {
  const candidates = [
    { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4', label: 'MP4 (H.264)' },
    { mime: 'video/mp4;codecs=avc1', ext: 'mp4', label: 'MP4 (H.264)' },
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm', label: 'WebM (VP9)' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm', label: 'WebM (VP8)' },
    { mime: 'video/webm', ext: 'webm', label: 'WebM' },
  ];
  return candidates.find(candidate => isSupported(candidate.mime)) ?? null;
}
