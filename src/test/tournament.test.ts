import { describe, expect, it } from 'vitest';
import { bands, drawAll, drawBand, initialState, matches, resolveSource, setResult, standings } from '@/lib/padel/tournament';
describe('Excel tournament rules', () => {
  it('automatically places TS2 at L4 and TS1 at L30', () => { expect(initialState().draw).toEqual({ L4: 2, L30: 1 }); });
  it.each(Object.keys(bands))('draws %s only within its rank band without repeats', band => {
    const s = drawBand(initialState(), band, () => 0.3); const group = bands[band];
    if (!group) throw new Error('Missing band');
    expect(group.slots.map(slot => s.draw[slot]).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(group.ranks);
  });
  it('C4=1 advances B4 to G6 and B6 to B34', () => {
    const s = setResult({ ...initialState(), draw: { ...initialState().draw, B4: 9, B6: 13 } }, 1, 1);
    expect(resolveSource(s, { match: 1, outcome: 'winner' })?.rank).toBe(9);
    expect(resolveSource(s, { match: 1, outcome: 'loser' })?.rank).toBe(13);
    expect(matches.find(m => m.id === 5)?.entries[1]).toEqual({ match: 1, outcome: 'winner' });
    expect(matches.find(m => m.id === 9)?.entries[0]).toEqual({ match: 1, outcome: 'loser' });
  });
  it('0 selects the bottom team, unlike a blank result', () => {
    const s = drawAll(initialState());
    expect(resolveSource(s, { match: 1, outcome: 'winner' })).toBeUndefined();
    expect(resolveSource(setResult(s, 1, 0), { match: 1, outcome: 'winner' })?.rank).toBe(s.draw['B6']);
  });
  it('clears downstream results when an earlier result changes', () => {
    let s = drawAll(initialState()); s = setResult(s, 1, 1); s = setResult(s, 5, 1); s = setResult(s, 13, 1);
    s = setResult(s, 1, 0); expect(s.results[5]).toBeUndefined(); expect(s.results[13]).toBeUndefined();
  });
  it('all 28 matches classify all 16 teams exactly once', () => {
    let s = drawAll(initialState()); for (const m of matches) s = setResult(s, m.id, 1);
    expect(Object.keys(s.results)).toHaveLength(28); const rows = standings(s);
    expect(rows.map(r => r.place)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(new Set(rows.map(r => r.team.rank)).size).toBe(16);
  });
});