const { z } = require('zod');
const { isValidDateString, isFutureDateIST } = require('../utils/date');

const SLOT_LABELS = {
  morning_fasting: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};

const VALID_SLOTS = Object.keys(SLOT_LABELS);

/**
 * Validates whether an ID string is a safe, positive 64-bit integer
 * matching PostgreSQL BIGINT identity constraints.
 * @param {string|number} id
 * @returns {boolean}
 */
function isValidId(id) {
  if (id === undefined || id === null) return false;
  const str = String(id).trim();
  if (!/^\d+$/.test(str)) return false;
  // Maximum PostgreSQL BIGINT length is 9223372036854775807 (19 digits)
  if (str.length > 19) return false;
  if (str.length === 19 && BigInt(str) > 9223372036854775807n) return false;
  if (BigInt(str) <= 0n) return false;
  return true;
}


const glucoseValueSchema = z
  .custom((val) => true)
  .superRefine((val, ctx) => {
    if (
      val === undefined ||
      val === null ||
      (typeof val === 'string' && val.trim() === '')
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please enter a glucose value.',
      });
      return;
    }
    const num =
      typeof val === 'number'
        ? val
        : typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val.trim())
        ? Number(val.trim())
        : NaN;
    if (isNaN(num) || !Number.isInteger(num) || num < 40 || num > 600) {
      ctx.addIssue({
        code: 'custom',
        message: 'Value must be between 40 and 600 mg/dl.',
      });
      return;
    }
  })
  .transform((val) => (typeof val === 'number' ? val : Number(val)));

/**
 * Reading Date Schema
 * - Required, valid YYYY-MM-DD calendar date
 * - Cannot be in the future relative to Indian Standard Time (Asia/Kolkata)
 */
const dateSchema = z
  .string({ required_error: 'Date is required' })
  .trim()
  .superRefine((val, ctx) => {
    if (!val) {
      ctx.addIssue({
        code: 'custom',
        message: 'Date is required',
      });
      return;
    }
    if (!isValidDateString(val)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please provide a valid date in YYYY-MM-DD format.',
      });
      return;
    }
    if (isFutureDateIST(val)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Date cannot be in the future.',
      });
      return;
    }
  });

/**
 * Meal Slot Schema
 * Must be one of the four clinical time slots
 */
const slotSchema = z.enum(VALID_SLOTS, {
  message: 'Invalid time slot selected.',
});

/**
 * Schema for creating a new blood glucose reading
 */
const createReadingSchema = z.object({
  value: glucoseValueSchema,
  date: dateSchema,
  slot: slotSchema,
});

/**
 * Schema for full update (PUT /api/readings/:id)
 */
const updateReadingSchema = z.object({
  value: glucoseValueSchema,
  date: dateSchema,
  slot: slotSchema,
});

/**
 * Schema for partial update (PATCH /api/readings/:id)
 */
const patchReadingSchema = z
  .object({
    value: glucoseValueSchema.optional(),
    date: dateSchema.optional(),
    slot: slotSchema.optional(),
  })
  .refine(
    (data) => {
      const keys = Object.keys(data);
      return keys.length > 0 && keys.some((k) => data[k] !== undefined);
    },
    {
      message: 'At least one field must be provided for update.',
    }
  );

/**
 * Schema for querying readings (GET /api/readings)
 */
const queryReadingsSchema = z.object({
  date: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z
      .string()
      .trim()
      .refine((val) => isValidDateString(val), {
        message: 'Please provide a valid date in YYYY-MM-DD format.',
      })
      .optional()
  ),
  page: z.preprocess(
    (val) =>
      val === undefined || (typeof val === 'string' && val.trim() === '')
        ? undefined
        : Number(val),
    z.number().int().min(1).optional()
  ),
  limit: z.preprocess(
    (val) =>
      val === undefined || (typeof val === 'string' && val.trim() === '')
        ? undefined
        : Number(val),
    z.number().int().min(1).max(100).optional()
  ),
});

module.exports = {
  isValidId,
  SLOT_LABELS,
  VALID_SLOTS,
  glucoseValueSchema,
  dateSchema,
  slotSchema,
  createReadingSchema,
  updateReadingSchema,
  patchReadingSchema,
  queryReadingsSchema,
};
