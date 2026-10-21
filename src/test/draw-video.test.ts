import { describe, expect, it } from 'vitest';
import { drawAll, initialState } from '@/lib/padel/tournament';
import {
  INTRO_END,
  REVEAL_END,
  VIDEO_SECONDS,
  isDrawComplete,
  pickVideoFormat,
  revealSequence,
  revealTime,
  videoColumns,
} from '@/lib/padel/draw-video';

describe('draw video data', () => {
  const state = drawAll(initialState());
  it('needs a complete draw', () => {
    expect(isDrawComplete(initialState())).toBe(false);
    expect(isDrawComplete(state)).toBe(true);
  });
  it('reveals all 16 teams once, seeds first', () => {
    const sequence = revealSequence(state);
    expect(sequence).toHaveLength(16);
    expect(new Set(sequence.map(item => item.team.rank)).size).toBe(16);
    expect(sequence.slice(0, 2).map(item => item.team.rank)).toEqual([1, 2]);
  });
  it('builds only the first three columns with 16 unique teams', () => {
    const columns = videoColumns(state);
    expect(columns.map(column => column.title)).toEqual(['1er tour', '2e tour', 'Quarts de finale']);
    const ranks = columns.flatMap(column => column.matches.flat()).map(entry => entry.rank).filter(Boolean);
    expect(new Set(ranks).size).toBe(16);
    expect(columns[2]!.matches[0]![0].rank).toBe(2);
    expect(columns[2]!.matches[3]![1].rank).toBe(1);
  });
  it('keeps unrevealed bracket slots blank and fills them only when revealed', () => {
    const blank = videoColumns(state, new Set());
    expect(blank[0]!.matches.flat().every(entry => entry.label === 'À tirer' && entry.rank === undefined)).toBe(true);
    const firstTeam = revealSequence(state)[0]!;
    const partial = videoColumns(state, new Set([firstTeam.slot]));
    expect(partial[2]!.matches[3]![1].rank).toBe(1);
    expect(partial[2]!.matches[0]![0].label).toBe('À tirer');
    const visible = videoColumns(state, new Set(revealSequence(state).map(item => item.slot)));
    const ranks = visible.flatMap(column => column.matches.flat()).map(entry => entry.rank).filter(Boolean);
    expect(new Set(ranks).size).toBe(16);
  });
  it('uses a 45-second maximum with time for the final board', () => {
    expect(VIDEO_SECONDS).toBe(45);
    expect(INTRO_END).toBeLessThan(REVEAL_END);
    expect(REVEAL_END).toBeLessThan(VIDEO_SECONDS);
    expect(revealTime(15, 16) + (REVEAL_END - INTRO_END) / 16).toBeCloseTo(REVEAL_END);
  });
  it('uses WebM only when MP4 H.264 is unavailable', () => {
    expect(pickVideoFormat(type => type.startsWith('video/webm'))?.ext).toBe('webm');
    expect(pickVideoFormat(type => type === 'video/mp4;codecs=avc1')?.label).toBe('MP4 (H.264)');
  });
});
