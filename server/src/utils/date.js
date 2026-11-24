/**
 * Indian Standard Time (IST, UTC+5:30, Asia/Kolkata) date helpers.
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns the current calendar date in Asia/Kolkata timezone in ISO format (YYYY-MM-DD).
 * @param {Date} [d=new Date()] Optional Date object to evaluate
 * @returns {string} Date string in 'YYYY-MM-DD'
 */
function getTodayInIST(d = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Validates that a string is a strictly valid calendar date formatted as YYYY-MM-DD.
 * @param {string} str 
 * @returns {boolean}
 */
function isValidDateString(str) {
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

/**
 * Checks whether a given YYYY-MM-DD date string lies in the future relative to Asia/Kolkata today.
 * @param {string} dateStr 
 * @returns {boolean}
 */
function isFutureDateIST(dateStr) {
  const todayIST = getTodayInIST();
  return dateStr > todayIST;
}

/**
 * Ensures a date is formatted strictly as 'YYYY-MM-DD' without time or timezone offset.
 * @param {string|Date} d 
 * @returns {string}
 */
function formatDateOnly(d) {
  if (!d) return d;
  if (typeof d === 'string') {
    return d.split('T')[0];
  }
  if (d instanceof Date) {
    return d.toISOString().split('T')[0];
  }
  return String(d);
}

module.exports = {
  getTodayInIST,
  isValidDateString,
  isFutureDateIST,
  formatDateOnly,
};
