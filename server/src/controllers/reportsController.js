const { query } = require('../config/db');
const { getReportDateRange, formatDateOnly, getTodayInIST } = require('../utils/date');

/**
 * Normalizes reading row data for JSON API response
 */
function formatReading(row) {
  return {
    id: row.id.toString(),
    userId: row.user_id ? row.user_id.toString() : undefined,
    date: formatDateOnly(row.date),
    slot: row.slot,
    value: Number(row.value),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/reports
 * Generates aggregated glycemic reports (daily, month_to_date, monthly)
 */
async function getReport(req, res, next) {
  try {
    const userId = req.user.userId;
    const { type } = req.query;
    const selectedDate = req.query.date || getTodayInIST();

    const { dateFrom, dateTo } = getReportDateRange(type, selectedDate);

    // 1. Calculate aggregated statistics
    const statsRes = await query(
      `SELECT 
         COUNT(*)::int AS count,
         MAX(value)::int AS highest,
         MIN(value)::int AS lowest,
         AVG(value)::float AS average
       FROM readings
       WHERE user_id = $1 AND date >= $2 AND date <= $3;`,
      [userId, dateFrom, dateTo]
    );

    const row = statsRes.rows[0] || {};
    const count = Number(row.count) || 0;

    const stats = {
      count,
      highest: count > 0 && row.highest !== null ? Number(row.highest) : null,
      lowest: count > 0 && row.lowest !== null ? Number(row.lowest) : null,
      average:
        count > 0 && row.average !== null
          ? Math.round(Number(row.average) * 10) / 10
          : null,
    };

    // 2. Fetch detailed slot readings for daily reports
    let readings = [];
    if (type === 'daily') {
      const readingsRes = await query(
        `SELECT id, user_id, date, slot, value, created_at, updated_at
         FROM readings
         WHERE user_id = $1 AND date = $2
         ORDER BY 
           CASE slot
             WHEN 'morning_fasting' THEN 1
             WHEN 'after_breakfast' THEN 2
             WHEN 'after_lunch' THEN 3
             WHEN 'after_dinner' THEN 4
             ELSE 5
           END ASC;`,
        [userId, selectedDate]
      );
      readings = readingsRes.rows.map(formatReading);
    }

    return res.status(200).json({
      type,
      selectedDate,
      dateFrom,
      dateTo,
      stats,
      readings,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getReport,
  formatReading,
};
