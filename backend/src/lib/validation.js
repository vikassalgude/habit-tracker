import { DateTime } from 'luxon';

/**
 * Validates a date string intended for use as a check-in localDate.
 *
 * Rules (from spec):
 *   - Must be YYYY-MM-DD format
 *   - Must NOT be in the future relative to the user's local today
 *
 * @param {string} date       - The date string to validate (YYYY-MM-DD)
 * @param {string} todayLocal - The user's current local date (YYYY-MM-DD)
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCheckInDate(date, todayLocal) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { valid: false, error: 'date must be in YYYY-MM-DD format' };
  }

  const parsed = DateTime.fromISO(date);
  if (!parsed.isValid) {
    return { valid: false, error: `"${date}" is not a valid date` };
  }

  if (date > todayLocal) {
    return { valid: false, error: 'Cannot log a future date' };
  }

  return { valid: true };
}
