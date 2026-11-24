const { getTodayInIST, isValidDateString } = require('../src/utils/date');
const {
  createReadingSchema,
  updateReadingSchema,
  patchReadingSchema,
  queryReadingsSchema,
  SLOT_LABELS,
  isValidId,
} = require('../src/validators/readingValidator');

describe('isValidId Helper', () => {
  it('accepts valid positive bigint ID strings', () => {
    expect(isValidId('1')).toBe(true);
    expect(isValidId('42')).toBe(true);
    expect(isValidId('9223372036854775807')).toBe(true); // PostgreSQL BIGINT max
  });

  it('rejects non-numeric, negative, zero, and out-of-range bigint IDs', () => {
    expect(isValidId('0')).toBe(false);
    expect(isValidId('-1')).toBe(false);
    expect(isValidId('abc')).toBe(false);
    expect(isValidId('1.5')).toBe(false);
    expect(isValidId('')).toBe(false);
    expect(isValidId(null)).toBe(false);
    expect(isValidId(undefined)).toBe(false);
    expect(isValidId('9223372036854775808')).toBe(false); // Exceeds signed 64-bit int
    expect(isValidId('999999999999999999999999999999')).toBe(false);
  });
});

describe('Date Utilities & IST Helper', () => {
  it('returns today date in YYYY-MM-DD format in Asia/Kolkata timezone', () => {
    const today = getTodayInIST();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('correctly shifts date across midnight IST when UTC is on previous day', () => {
    // 2026-11-24 19:00:00 UTC is 2026-11-25 00:30:00 IST
    const lateUtcDate = new Date('2026-11-24T19:00:00.000Z');
    expect(getTodayInIST(lateUtcDate)).toBe('2026-11-25');

    // 2026-11-24 18:00:00 UTC is 2026-11-24 23:30:00 IST
    const earlyUtcDate = new Date('2026-11-24T18:00:00.000Z');
    expect(getTodayInIST(earlyUtcDate)).toBe('2026-11-24');
  });

  it('validates calendar date format correctly', () => {
    expect(isValidDateString('2026-11-24')).toBe(true);
    expect(isValidDateString('2026-02-28')).toBe(true);
    expect(isValidDateString('2026-02-30')).toBe(false); // Invalid Feb date
    expect(isValidDateString('invalid-date')).toBe(false);
    expect(isValidDateString('24-11-2026')).toBe(false);
  });
});

describe('Reading Validation Schemas', () => {
  const validPayload = {
    date: '2026-10-15',
    slot: 'after_lunch',
    value: 120,
  };

  describe('createReadingSchema', () => {
    it('accepts valid payload', () => {
      const parsed = createReadingSchema.parse(validPayload);
      expect(parsed.value).toBe(120);
      expect(parsed.date).toBe('2026-10-15');
      expect(parsed.slot).toBe('after_lunch');
    });

    it('accepts boundary values 40 and 600', () => {
      expect(createReadingSchema.parse({ ...validPayload, value: 40 }).value).toBe(40);
      expect(createReadingSchema.parse({ ...validPayload, value: 600 }).value).toBe(600);
    });

    it('rejects missing or empty value with exact verbatim error', () => {
      const resMissing = createReadingSchema.safeParse({ date: '2026-10-15', slot: 'after_lunch' });
      expect(resMissing.success).toBe(false);
      expect(resMissing.error.issues[0].message).toBe('Please enter a glucose value.');

      const resNull = createReadingSchema.safeParse({ ...validPayload, value: null });
      expect(resNull.success).toBe(false);
      expect(resNull.error.issues[0].message).toBe('Please enter a glucose value.');

      const resEmpty = createReadingSchema.safeParse({ ...validPayload, value: '' });
      expect(resEmpty.success).toBe(false);
      expect(resEmpty.error.issues[0].message).toBe('Please enter a glucose value.');

      const resWhitespace = createReadingSchema.safeParse({ ...validPayload, value: '   ' });
      expect(resWhitespace.success).toBe(false);
      expect(resWhitespace.error.issues[0].message).toBe('Please enter a glucose value.');
    });

    it('rejects values out of range or non-integers with exact verbatim error', () => {
      const cases = [39, 601, 120.5, 'abc', -5, 0];
      for (const val of cases) {
        const res = createReadingSchema.safeParse({ ...validPayload, value: val });
        expect(res.success).toBe(false);
        expect(res.error.issues[0].message).toBe('Value must be between 40 and 600 mg/dl.');
      }
    });

    it('rejects future dates relative to IST with exact verbatim error', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const futureDateStr = tomorrow.toISOString().split('T')[0];

      const res = createReadingSchema.safeParse({ ...validPayload, date: futureDateStr });
      expect(res.success).toBe(false);
      expect(res.error.issues[0].message).toBe('Date cannot be in the future.');
    });

    it('rejects invalid meal slots with exact error', () => {
      const res = createReadingSchema.safeParse({ ...validPayload, slot: 'midnight_snack' });
      expect(res.success).toBe(false);
      expect(res.error.issues[0].message).toBe('Invalid time slot selected.');
    });

    it('accepts all 4 valid meal slots', () => {
      const slots = ['morning_fasting', 'after_breakfast', 'after_lunch', 'after_dinner'];
      for (const slot of slots) {
        const res = createReadingSchema.safeParse({ ...validPayload, slot });
        expect(res.success).toBe(true);
        expect(SLOT_LABELS[slot]).toBeDefined();
      }
    });
  });

  describe('updateReadingSchema (PUT)', () => {
    it('requires all fields for full replacement', () => {
      const res = updateReadingSchema.safeParse({ value: 140 });
      expect(res.success).toBe(false);
    });

    it('validates valid full update payload', () => {
      const res = updateReadingSchema.safeParse(validPayload);
      expect(res.success).toBe(true);
    });
  });

  describe('patchReadingSchema (PATCH)', () => {
    it('accepts partial update with single field', () => {
      const res = patchReadingSchema.safeParse({ value: 150 });
      expect(res.success).toBe(true);
      expect(res.data.value).toBe(150);
    });

    it('rejects empty payload when patching', () => {
      const res = patchReadingSchema.safeParse({});
      expect(res.success).toBe(false);
      expect(res.error.issues[0].message).toBe('At least one field must be provided for update.');
    });

    it('validates fields if provided', () => {
      const res = patchReadingSchema.safeParse({ value: 30 });
      expect(res.success).toBe(false);
      expect(res.error.issues[0].message).toBe('Value must be between 40 and 600 mg/dl.');
    });
  });

  describe('queryReadingsSchema', () => {
    it('parses valid query parameters', () => {
      const res = queryReadingsSchema.parse({ date: '2026-10-15' });
      expect(res.date).toBe('2026-10-15');
    });

    it('rejects invalid calendar dates in date query parameter', () => {
      const res = queryReadingsSchema.safeParse({ date: '2026-02-31' });
      expect(res.success).toBe(false);
      expect(res.error.issues[0].message).toBe('Please provide a valid date in YYYY-MM-DD format.');
    });

    it('gracefully treats empty string query parameters as undefined', () => {
      const res = queryReadingsSchema.parse({ date: '', page: '', limit: '' });
      expect(res.date).toBeUndefined();
      expect(res.page).toBeUndefined();
      expect(res.limit).toBeUndefined();
    });

    it('parses and casts pagination parameters', () => {
      const res = queryReadingsSchema.parse({ page: '2', limit: '15' });
      expect(res.page).toBe(2);
      expect(res.limit).toBe(15);
    });

    it('rejects invalid pagination parameters', () => {
      const resPage = queryReadingsSchema.safeParse({ page: '0' });
      expect(resPage.success).toBe(false);

      const resLimit = queryReadingsSchema.safeParse({ limit: '101' });
      expect(resLimit.success).toBe(false);
    });
  });
});
