const { z } = require('zod');
const { isValidDateString, getTodayInIST } = require('../utils/date');

const REPORT_TYPES = ['daily', 'month_to_date', 'monthly'];

const queryReportSchema = z.object({
  type: z.enum(REPORT_TYPES, {
    message: 'Report type must be one of: daily, month_to_date, monthly',
  }),
  date: z
    .preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z
        .string()
        .trim()
        .refine(isValidDateString, {
          message: 'Please provide a valid date in YYYY-MM-DD format.',
        })
        .optional()
    )
    .default(() => getTodayInIST()),
});

module.exports = {
  queryReportSchema,
  REPORT_TYPES,
};
