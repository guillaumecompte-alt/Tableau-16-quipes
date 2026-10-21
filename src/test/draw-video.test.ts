import { describe, expect, it } from 'vitest';
import { drawAll, initialState } from '@/lib/padel/tournament';
import { isDrawComplete, pickVideoFormat, revealSequence, videoColumns } from '@/lib/padel/draw-video';

describe('draw video data', () => {
  const s = drawAll(initialState());
  it('needs a complete draw', () => { expect(isDrawComplete(initialState())).toBe(false); expect(isDrawComplete(s)).toBe(true); });
  it('reveals all 16 teams once, seeds first', () => {
    const seq = revealSequence(s);
    expect(seq).toHaveLength(16);
    expect(new Set(seq.map(r => r.team.rank)).size).toBe(16);
    expect(seq.slice(0, 2).map(r => r.team.rank)).toEqual([1, 2]);
  });
  it('shows only 3 columns with 16 distinct teams and seeds in quarters', () => {
    const cols = videoColumns(s);
    expect(cols.map(c => c.title)).toEqual(['1er tour', '2e tour', 'Quarts de finale']);
    const ranks = cols.flatMap(c => c.matches.flat()).map(e => e.rank).filter(Boolean);
    expect(new Set(ranks).size).toBe(16);
    expect(cols[2]!.matches[0]![0].rank).toBe(2);
    expect(cols[2]!.matches[3]![1].rank).toBe(1);
  });
  it('falls back to WebM when MP4 is unsupported', () => {
    expect(pickVideoFormat(t => t.startsWith('video/webm'))?.ext).toBe('webm');
    expect(pickVideoFormat(t => t === 'video/mp4;codecs=avc1')?.label).toBe('MP4 (H.264)');
  });
});