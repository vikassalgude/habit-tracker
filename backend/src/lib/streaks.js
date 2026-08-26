import { DateTime } from 'luxon';

/**
 * Diff two YYYY-MM-DD calendar dates, returning the number of whole days
 * between them (a - b). Uses Luxon to avoid DST bugs.
 *
 * @param {string} a - YYYY-MM-DD
 * @param {string} b - YYYY-MM-DD
 * @returns {number}
 */
export function diffDays(a, b) {
  return DateTime.fromISO(a).diff(DateTime.fromISO(b), 'days').days;
}

/**
 * Compute current and longest streaks from a sorted, deduplicated list of
 * check-in dates. Never stores a mutable counter — always derived from raw dates.
 *
 * @param {string[]} dates - YYYY-MM-DD strings, sorted ascending, deduplicated
 * @param {string}   todayLocal - YYYY-MM-DD for the requesting user's local day
 * @returns {{ current: number, longest: number }}
 */
export function computeStreaks(dates, todayLocal) {
  if (dates.length === 0) return { current: 0, longest: 0 };

  // Compute longest streak
  let longest = 1, run = 1;
  for (let i = 1; i < dates.length; i++) {
    run = diffDays(dates[i], dates[i - 1]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  // Compute current streak
  const gap = diffDays(todayLocal, dates[dates.length - 1]);
  let current = 0;
  if (gap === 0 || gap === 1) {
    // Checked in today (gap === 0) or yesterday and today hasn't ended yet (gap === 1)
    current = 1;
    for (let i = dates.length - 1; i > 0; i--) {
      if (diffDays(dates[i], dates[i - 1]) === 1) current++;
      else break;
    }
  }

  return { current, longest };
}
