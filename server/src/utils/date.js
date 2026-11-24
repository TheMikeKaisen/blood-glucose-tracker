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

/**
 * Calculates start and end calendar dates for reports:
 * - 'daily': dateFrom = dateTo = dateStr
 * - 'month_to_date': dateFrom = 1st of month, dateTo = dateStr
 * - 'monthly': whole previous month (e.g. 2026-10-15 -> 2026-09-01 to 2026-09-30)
 *
 * @param {'daily'|'month_to_date'|'monthly'} type
 * @param {string} dateStr Calendar date in YYYY-MM-DD format
 * @returns {{ dateFrom: string, dateTo: string }}
 */
function getReportDateRange(type, dateStr) {
  const [year, month] = dateStr.split('-').map(Number);

  if (type === 'daily') {
    return { dateFrom: dateStr, dateTo: dateStr };
  }

  if (type === 'month_to_date') {
    const formattedYear = String(year).padStart(4, '0');
    const formattedMonth = String(month).padStart(2, '0');
    return { dateFrom: `${formattedYear}-${formattedMonth}-01`, dateTo: dateStr };
  }

  if (type === 'monthly') {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const daysInPrevMonth = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
    const formattedYear = String(prevYear).padStart(4, '0');
    const formattedMonth = String(prevMonth).padStart(2, '0');
    const formattedDay = String(daysInPrevMonth).padStart(2, '0');
    return {
      dateFrom: `${formattedYear}-${formattedMonth}-01`,
      dateTo: `${formattedYear}-${formattedMonth}-${formattedDay}`,
    };
  }

  throw new Error(`Unsupported report type: ${type}`);
}

module.exports = {
  getTodayInIST,
  isValidDateString,
  isFutureDateIST,
  formatDateOnly,
  getReportDateRange,
};
