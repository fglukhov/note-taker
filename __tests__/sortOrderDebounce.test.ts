/**
 * `NotesList` uses two delays: `scheduleSyncUpdate` → 1s before `setIsChanged(true)` and copying `updatedIds`
 * into `savedUpdatedIds`; then an effect on `isChanged` + `notesFeed` arms an 800ms timer before `reorderCallback`.
 * That ordering window is a plausible source of mismatched `ids[]` vs the `feed` snapshot sent to `/api/update`.
 */

import { describe, expect, it, vi } from 'vitest';

describe('debounce / timer interaction (model)', () => {
  it('800ms reorder timer coalesces when cleared and rescheduled like the isChanged effect', () => {
    vi.useFakeTimers();
    let fires = 0;
    let reorderTimeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleReorder = () => {
      if (reorderTimeout) clearTimeout(reorderTimeout);
      reorderTimeout = setTimeout(() => {
        fires += 1;
        reorderTimeout = null;
      }, 800);
    };
    scheduleReorder();
    vi.advanceTimersByTime(400);
    scheduleReorder();
    vi.advanceTimersByTime(800);
    expect(fires).toBe(1);
    vi.useRealTimers();
  });

  it('independent 1s and 800ms timers: which runs first depends on start offsets', () => {
    vi.useFakeTimers();
    const log: string[] = [];
    setTimeout(() => log.push('1s'), 1000);
    setTimeout(() => log.push('800ms'), 800);
    vi.advanceTimersByTime(900);
    expect(log).toEqual(['800ms']);
    vi.advanceTimersByTime(200);
    expect(log).toEqual(['800ms', '1s']);
    vi.useRealTimers();
  });
});
