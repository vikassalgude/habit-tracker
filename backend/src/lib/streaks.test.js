import { describe, it, expect } from 'vitest';
import { computeStreaks } from './streaks.js';

describe('computeStreaks', () => {
  // 1. Empty history
  it('returns {current: 0, longest: 0} for empty history', () => {
    expect(computeStreaks([], '2024-03-15')).toEqual({ current: 0, longest: 0 });
  });

  // 2. Single check-in today
  it('returns {current: 1, longest: 1} for a single check-in today', () => {
    expect(computeStreaks(['2024-03-15'], '2024-03-15')).toEqual({ current: 1, longest: 1 });
  });

  // 3. Broken streak — gap in the middle
  it('correctly computes longest across a broken streak and current from the tail', () => {
    // Streak of 3, gap, streak of 2 — today is last day of the trailing 2
    const dates = ['2024-03-01', '2024-03-02', '2024-03-03', '2024-03-07', '2024-03-08'];
    expect(computeStreaks(dates, '2024-03-08')).toEqual({ current: 2, longest: 3 });
  });

  // 4. Backfill fills a gap — two runs merge into one longer run
  it('merges two separate runs into one when a gap date is backfilled', () => {
    // Before backfill: [Mar1, Mar2] gap [Mar4, Mar5] → longest=2
    // After backfill of Mar3: [Mar1, Mar2, Mar3, Mar4, Mar5] → longest=5
    const dates = ['2024-03-01', '2024-03-02', '2024-03-03', '2024-03-04', '2024-03-05'];
    expect(computeStreaks(dates, '2024-03-05')).toEqual({ current: 5, longest: 5 });
  });

  // 5. Last check-in was yesterday — current streak still alive
  it('keeps current streak alive when last check-in was yesterday', () => {
    const dates = ['2024-03-10', '2024-03-11', '2024-03-12', '2024-03-13', '2024-03-14'];
    // Today is Mar 15, last check-in was Mar 14 (yesterday)
    expect(computeStreaks(dates, '2024-03-15')).toEqual({ current: 5, longest: 5 });
  });

  // 6. Last check-in was 2+ days ago — current streak breaks
  it('returns current: 0 when last check-in was 2+ days ago', () => {
    const dates = ['2024-03-10', '2024-03-11', '2024-03-12'];
    // Today is Mar 15, last check-in was Mar 12 (3 days ago)
    expect(computeStreaks(dates, '2024-03-15')).toEqual({ current: 0, longest: 3 });
  });

  // Bonus: longest with a single-day gap only breaks current, not longest
  it('longest streak is unaffected when current streak is broken', () => {
    const dates = [
      '2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', // run of 5
      '2024-03-10', // isolated, current streak
    ];
    // Today is Mar 12 — last check-in was 2 days ago, current = 0
    expect(computeStreaks(dates, '2024-03-12')).toEqual({ current: 0, longest: 5 });
  });
});
