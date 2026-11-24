/**
 * Date utility functions for calendar date integrity (YYYY-MM-DD)
 * Prevents UTC midnight boundary shifting.
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns current calendar date in local system time in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  // en-CA outputs YYYY-MM-DD in local system time
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Validates that a string is a strictly valid calendar date formatted as YYYY-MM-DD.
 * Rejects invalid dates such as Feb 29 in non-leap years.
 */
export function isValidDateString(str: string): boolean {
  if (typeof str !== 'string' || !DATE_REGEX.test(str)) {
    return false;
  }
  const [year, month, day] = str.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function isFutureDate(dateStr: string): boolean {
  return dateStr > getTodayDateString();
}

export function isToday(dateStr: string): boolean {
  return dateStr === getTodayDateString();
}

export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA');
}

export function formatFriendlyDate(dateStr: string): string {
  if (isToday(dateStr)) {
    return 'Today';
  }
  const yesterday = addDays(getTodayDateString(), -1);
  if (dateStr === yesterday) {
    return 'Yesterday';
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatFullDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatRangeLabel(dateFrom: string, dateTo: string): string {
  const [y1, m1, d1] = dateFrom.split('-').map(Number);
  const [y2, m2, d2] = dateTo.split('-').map(Number);
  const dObj1 = new Date(y1, m1 - 1, d1);
  const dObj2 = new Date(y2, m2 - 1, d2);

  const month1 = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(dObj1);
  const month2 = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(dObj2);

  if (dateFrom === dateTo) {
    return `${d1} ${month1} ${y1}`;
  }

  if (y1 === y2 && m1 === m2) {
    return `${d1} – ${d2} ${month1} ${y1}`;
  }

  if (y1 === y2) {
    return `${d1} ${month1} – ${d2} ${month2} ${y1}`;
  }

  return `${d1} ${month1} ${y1} – ${d2} ${month2} ${y2}`;
}
