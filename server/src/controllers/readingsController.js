const { query } = require('../config/db');
const { formatDateOnly } = require('../utils/date');
const { SLOT_LABELS, isValidId } = require('../validators/readingValidator');

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
 * POST /api/readings
 * Create a new blood glucose reading
 */
async function createReading(req, res, next) {
  try {
    const userId = req.user.userId;
    const { date, slot, value } = req.body;

    // Rule 1: Maximum 4 readings per day
    const countRes = await query(
      'SELECT COUNT(*) FROM readings WHERE user_id = $1 AND date = $2;',
      [userId, date]
    );
    if (parseInt(countRes.rows[0].count, 10) >= 4) {
      return res.status(409).json({
        error: 'You can add only 4 readings per day.',
      });
    }

    // Rule 2: Only one reading per slot per day
    const dupRes = await query(
      'SELECT id FROM readings WHERE user_id = $1 AND date = $2 AND slot = $3;',
      [userId, date, slot]
    );
    if (dupRes.rows.length > 0) {
      return res.status(409).json({
        error: `You already have an ${SLOT_LABELS[slot]} reading for this date.`,
      });
    }

    // Insert reading
    try {
      const insertRes = await query(
        `INSERT INTO readings (user_id, date, slot, value)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, date, slot, value, created_at, updated_at;`,
        [userId, date, slot, value]
      );

      return res.status(201).json({
        reading: formatReading(insertRes.rows[0]),
      });
    } catch (err) {
      // 23505 = unique_violation concurrency race defense
      if (err.code === '23505') {
        return res.status(409).json({
          error: `You already have an ${SLOT_LABELS[slot]} reading for this date.`,
        });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/readings
 * - If ?date=YYYY-MM-DD: returns daily readings ordered chronologically by slot
 * - Otherwise: returns paginated list with pagination envelope
 */
async function getReadings(req, res, next) {
  try {
    const userId = req.user.userId;
    const { date, page, limit } = req.query;

    if (date) {
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
        [userId, date]
      );

      return res.status(200).json({
        data: readingsRes.rows.map(formatReading),
      });
    }

    // Paginated list
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const countRes = await query(
      'SELECT COUNT(*) FROM readings WHERE user_id = $1;',
      [userId]
    );
    const total = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(total / limitNum) || 1;

    const readingsRes = await query(
      `SELECT id, user_id, date, slot, value, created_at, updated_at
       FROM readings
       WHERE user_id = $1
       ORDER BY date DESC,
         CASE slot
           WHEN 'morning_fasting' THEN 1
           WHEN 'after_breakfast' THEN 2
           WHEN 'after_lunch' THEN 3
           WHEN 'after_dinner' THEN 4
           ELSE 5
         END ASC
       LIMIT $2 OFFSET $3;`,
      [userId, limitNum, offset]
    );

    return res.status(200).json({
      data: readingsRes.rows.map(formatReading),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/readings/:id
 * Retrieve a single reading with strict IDOR isolation
 */
async function getReadingById(req, res, next) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    const resReading = await query(
      `SELECT id, user_id, date, slot, value, created_at, updated_at
       FROM readings
       WHERE id = $1 AND user_id = $2;`,
      [id, userId]
    );

    if (resReading.rows.length === 0) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    return res.status(200).json({
      reading: formatReading(resReading.rows[0]),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/readings/:id
 * Full update of reading
 */
async function updateReading(req, res, next) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { date, slot, value } = req.body;

    if (!isValidId(id)) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    // Check reading exists and belongs to requesting user (IDOR prevention)
    const existing = await query(
      'SELECT id, date, slot, value FROM readings WHERE id = $1 AND user_id = $2;',
      [id, userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    const current = existing.rows[0];
    const currentDate = formatDateOnly(current.date);

    // If moving to a different date, verify target date has fewer than 4 readings
    if (date !== currentDate) {
      const countRes = await query(
        'SELECT COUNT(*) FROM readings WHERE user_id = $1 AND date = $2 AND id != $3;',
        [userId, date, id]
      );
      if (parseInt(countRes.rows[0].count, 10) >= 4) {
        return res.status(409).json({
          error: 'You can add only 4 readings per day.',
        });
      }
    }

    // Check duplicate slot on target date (excluding this reading)
    const dupRes = await query(
      'SELECT id FROM readings WHERE user_id = $1 AND date = $2 AND slot = $3 AND id != $4;',
      [userId, date, slot, id]
    );
    if (dupRes.rows.length > 0) {
      return res.status(409).json({
        error: `You already have an ${SLOT_LABELS[slot]} reading for this date.`,
      });
    }

    try {
      const updateRes = await query(
        `UPDATE readings
         SET date = $1, slot = $2, value = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND user_id = $5
         RETURNING id, user_id, date, slot, value, created_at, updated_at;`,
        [date, slot, value, id, userId]
      );

      if (!updateRes.rows || updateRes.rows.length === 0) {
        return res.status(404).json({ error: 'Reading not found' });
      }

      return res.status(200).json({
        reading: formatReading(updateRes.rows[0]),
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({
          error: `You already have an ${SLOT_LABELS[slot]} reading for this date.`,
        });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/readings/:id
 * Partial update of reading
 */
async function patchReading(req, res, next) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { date, slot, value } = req.body;

    if (!isValidId(id)) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    const existing = await query(
      'SELECT id, date, slot, value FROM readings WHERE id = $1 AND user_id = $2;',
      [id, userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    const current = existing.rows[0];
    const currentDate = formatDateOnly(current.date);

    const targetDate = date !== undefined ? date : currentDate;
    const targetSlot = slot !== undefined ? slot : current.slot;
    const targetValue = value !== undefined ? value : current.value;

    if (date !== undefined && targetDate !== currentDate) {
      const countRes = await query(
        'SELECT COUNT(*) FROM readings WHERE user_id = $1 AND date = $2 AND id != $3;',
        [userId, targetDate, id]
      );
      if (parseInt(countRes.rows[0].count, 10) >= 4) {
        return res.status(409).json({
          error: 'You can add only 4 readings per day.',
        });
      }
    }

    if (
      (slot !== undefined && targetSlot !== current.slot) ||
      (date !== undefined && targetDate !== currentDate)
    ) {
      const dupRes = await query(
        'SELECT id FROM readings WHERE user_id = $1 AND date = $2 AND slot = $3 AND id != $4;',
        [userId, targetDate, targetSlot, id]
      );
      if (dupRes.rows.length > 0) {
        return res.status(409).json({
          error: `You already have an ${SLOT_LABELS[targetSlot]} reading for this date.`,
        });
      }
    }

    try {
      const updateRes = await query(
        `UPDATE readings
         SET date = $1, slot = $2, value = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND user_id = $5
         RETURNING id, user_id, date, slot, value, created_at, updated_at;`,
        [targetDate, targetSlot, targetValue, id, userId]
      );

      if (!updateRes.rows || updateRes.rows.length === 0) {
        return res.status(404).json({ error: 'Reading not found' });
      }

      return res.status(200).json({
        reading: formatReading(updateRes.rows[0]),
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({
          error: `You already have an ${SLOT_LABELS[targetSlot]} reading for this date.`,
        });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/readings/:id
 * Delete reading with strict IDOR verification
 */
async function deleteReading(req, res, next) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    const delRes = await query(
      'DELETE FROM readings WHERE id = $1 AND user_id = $2 RETURNING id;',
      [id, userId]
    );

    if (delRes.rowCount === 0 || delRes.rows.length === 0) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    return res.status(200).json({
      message: 'Reading deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createReading,
  getReadings,
  getReadingById,
  updateReading,
  patchReading,
  deleteReading,
};
