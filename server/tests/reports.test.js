const request = require('supertest');
const app = require('../src/app');
const { pool, resetTestDb } = require('../src/config/db');
const { getReportDateRange, getTodayInIST } = require('../src/utils/date');
const { queryReportSchema, REPORT_TYPES } = require('../src/validators/reportValidator');

describe('Reports & Analytics (Phase 3)', () => {
  describe('Task 1: getReportDateRange calculation', () => {
    it('calculates daily range for selected date', () => {
      const range = getReportDateRange('daily', '2026-10-15');
      expect(range).toEqual({
        dateFrom: '2026-10-15',
        dateTo: '2026-10-15',
      });
    });

    it('calculates month_to_date range from the 1st of month to selected date', () => {
      const range = getReportDateRange('month_to_date', '2026-10-15');
      expect(range).toEqual({
        dateFrom: '2026-10-01',
        dateTo: '2026-10-15',
      });
    });

    it('calculates monthly range for standard 30-day previous month', () => {
      const range = getReportDateRange('monthly', '2026-10-15');
      expect(range).toEqual({
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
      });
    });

    it('calculates monthly range for January with previous year rollover to December', () => {
      const range = getReportDateRange('monthly', '2026-01-15');
      expect(range).toEqual({
        dateFrom: '2025-12-01',
        dateTo: '2025-12-31',
      });
    });

    it('calculates monthly range for March in leap year (February has 29 days)', () => {
      const range = getReportDateRange('monthly', '2024-03-10');
      expect(range).toEqual({
        dateFrom: '2024-02-01',
        dateTo: '2024-02-29',
      });
    });

    it('calculates monthly range for March in non-leap year (February has 28 days)', () => {
      const range = getReportDateRange('monthly', '2025-03-10');
      expect(range).toEqual({
        dateFrom: '2025-02-01',
        dateTo: '2025-02-28',
      });
    });

    it('calculates monthly range for century leap year 2000 (February has 29 days)', () => {
      const range = getReportDateRange('monthly', '2000-03-15');
      expect(range).toEqual({
        dateFrom: '2000-02-01',
        dateTo: '2000-02-29',
      });
    });

    it('calculates monthly range for century non-leap year 1900 (February has 28 days)', () => {
      const range = getReportDateRange('monthly', '1900-03-15');
      expect(range).toEqual({
        dateFrom: '1900-02-01',
        dateTo: '1900-02-28',
      });
    });

    it('calculates month_to_date for the 1st of the month where dateFrom equals dateTo', () => {
      const range = getReportDateRange('month_to_date', '2026-10-01');
      expect(range).toEqual({
        dateFrom: '2026-10-01',
        dateTo: '2026-10-01',
      });
    });

    it('throws error for unsupported report type', () => {
      expect(() => getReportDateRange('yearly', '2026-10-15')).toThrow(
        /Unsupported report type: yearly/
      );
    });
  });

  describe('Task 2: reportValidator query schema', () => {
    it('validates correct report query with explicit date', () => {
      const parsed = queryReportSchema.safeParse({
        type: 'daily',
        date: '2026-10-15',
      });
      expect(parsed.success).toBe(true);
      expect(parsed.data).toEqual({
        type: 'daily',
        date: '2026-10-15',
      });
    });

    it('defaults date to today in IST when date is omitted', () => {
      const today = getTodayInIST();
      const parsed = queryReportSchema.safeParse({
        type: 'month_to_date',
      });
      expect(parsed.success).toBe(true);
      expect(parsed.data.type).toBe('month_to_date');
      expect(parsed.data.date).toBe(today);
    });

    it('defaults date to today in IST when date is empty string or whitespace', () => {
      const today = getTodayInIST();
      const parsed = queryReportSchema.safeParse({
        type: 'monthly',
        date: '   ',
      });
      expect(parsed.success).toBe(true);
      expect(parsed.data.type).toBe('monthly');
      expect(parsed.data.date).toBe(today);
    });

    it('rejects missing report type', () => {
      const parsed = queryReportSchema.safeParse({
        date: '2026-10-15',
      });
      expect(parsed.success).toBe(false);
      expect(parsed.error.issues[0].message).toBe(
        'Report type must be one of: daily, month_to_date, monthly'
      );
    });

    it('rejects invalid report type', () => {
      const parsed = queryReportSchema.safeParse({
        type: 'yearly',
        date: '2026-10-15',
      });
      expect(parsed.success).toBe(false);
      expect(parsed.error.issues[0].message).toBe(
        'Report type must be one of: daily, month_to_date, monthly'
      );
    });

    it('rejects invalid calendar dates like 2026-02-31', () => {
      const parsed = queryReportSchema.safeParse({
        type: 'daily',
        date: '2026-02-31',
      });
      expect(parsed.success).toBe(false);
      expect(parsed.error.issues[0].message).toBe(
        'Please provide a valid date in YYYY-MM-DD format.'
      );
    });

    it('rejects non-date strings', () => {
      const parsed = queryReportSchema.safeParse({
        type: 'daily',
        date: 'not-a-date',
      });
      expect(parsed.success).toBe(false);
      expect(parsed.error.issues[0].message).toBe(
        'Please provide a valid date in YYYY-MM-DD format.'
      );
    });
  });

  describe('Tasks 3 & 4: GET /api/reports Integration Tests', () => {
    let userA, userB;

    async function createAuthenticatedUser(name, email, password = 'Password123!') {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({ name, email, password });

      return {
        user: regRes.body.user,
        cookies: regRes.headers['set-cookie'],
        csrfToken: regRes.body.csrfToken,
      };
    }

    async function addReading(user, { date, slot, value }) {
      return request(app)
        .post('/api/readings')
        .set('Cookie', user.cookies)
        .set('X-CSRF-Token', user.csrfToken)
        .send({ date, slot, value });
    }

    beforeEach(async () => {
      await resetTestDb();
      userA = await createAuthenticatedUser('Patient Alice', 'alice@sweety.dev');
      userB = await createAuthenticatedUser('Patient Bob', 'bob@sweety.dev');
    });

    afterAll(async () => {
      if (pool && typeof pool.end === 'function') {
        await pool.end();
      }
    });

    describe('Authentication & Access Control', () => {
      it('rejects unauthenticated requests with 401', async () => {
        const res = await request(app).get('/api/reports?type=daily');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Authentication required');
      });
    });

    describe('Validation Errors (Zod query boundary)', () => {
      it('rejects missing report type with 422', async () => {
        const res = await request(app)
          .get('/api/reports')
          .set('Cookie', userA.cookies);
        expect(res.status).toBe(422);
        expect(res.body.error).toBe(
          'Report type must be one of: daily, month_to_date, monthly'
        );
      });

      it('rejects invalid report type with 422', async () => {
        const res = await request(app)
          .get('/api/reports?type=weekly')
          .set('Cookie', userA.cookies);
        expect(res.status).toBe(422);
        expect(res.body.error).toBe(
          'Report type must be one of: daily, month_to_date, monthly'
        );
      });

      it('rejects invalid calendar dates like 2026-02-31 with 422', async () => {
        const res = await request(app)
          .get('/api/reports?type=daily&date=2026-02-31')
          .set('Cookie', userA.cookies);
        expect(res.status).toBe(422);
        expect(res.body.error).toBe(
          'Please provide a valid date in YYYY-MM-DD format.'
        );
      });
    });

    describe('Daily Reports (type=daily)', () => {
      it('returns stats and circadian-ordered readings for selected date', async () => {
        // Add 3 readings in non-chronological order
        await addReading(userA, { date: '2026-10-15', slot: 'after_lunch', value: 140 });
        await addReading(userA, { date: '2026-10-15', slot: 'morning_fasting', value: 95 });
        await addReading(userA, { date: '2026-10-15', slot: 'after_dinner', value: 210 });

        const res = await request(app)
          .get('/api/reports?type=daily&date=2026-10-15')
          .set('Cookie', userA.cookies);

        expect(res.status).toBe(200);
        expect(res.body.type).toBe('daily');
        expect(res.body.selectedDate).toBe('2026-10-15');
        expect(res.body.dateFrom).toBe('2026-10-15');
        expect(res.body.dateTo).toBe('2026-10-15');

        // Check stats: min 95, max 210, sum 445 / 3 = 148.333... -> 148.3
        expect(res.body.stats).toEqual({
          count: 3,
          highest: 210,
          lowest: 95,
          average: 148.3,
        });

        // Check chronological slot ordering: morning_fasting -> after_lunch -> after_dinner
        expect(res.body.readings).toHaveLength(3);
        expect(res.body.readings[0].slot).toBe('morning_fasting');
        expect(res.body.readings[0].value).toBe(95);
        expect(res.body.readings[1].slot).toBe('after_lunch');
        expect(res.body.readings[1].value).toBe(140);
        expect(res.body.readings[2].slot).toBe('after_dinner');
        expect(res.body.readings[2].value).toBe(210);
      });

      it('defaults to today in IST when date parameter is omitted', async () => {
        const today = getTodayInIST();
        await addReading(userA, { date: today, slot: 'morning_fasting', value: 105 });

        const res = await request(app)
          .get('/api/reports?type=daily')
          .set('Cookie', userA.cookies);

        expect(res.status).toBe(200);
        expect(res.body.selectedDate).toBe(today);
        expect(res.body.dateFrom).toBe(today);
        expect(res.body.dateTo).toBe(today);
        expect(res.body.stats.count).toBe(1);
        expect(res.body.stats.highest).toBe(105);
        expect(res.body.stats.lowest).toBe(105);
        expect(res.body.stats.average).toBe(105);
        expect(res.body.readings).toHaveLength(1);
      });
    });

    describe('Month-to-Date Reports (type=month_to_date)', () => {
      it('aggregates readings from the 1st of the month to selected date with empty readings array', async () => {
        // Readings out of boundary
        await addReading(userA, { date: '2026-09-30', slot: 'morning_fasting', value: 300 }); // previous month
        await addReading(userA, { date: '2026-10-20', slot: 'morning_fasting', value: 400 }); // after selected date

        // Readings within boundary: 2026-10-01 to 2026-10-15
        await addReading(userA, { date: '2026-10-01', slot: 'morning_fasting', value: 100 });
        await addReading(userA, { date: '2026-10-10', slot: 'after_lunch', value: 120 });
        await addReading(userA, { date: '2026-10-15', slot: 'after_dinner', value: 140 });

        const res = await request(app)
          .get('/api/reports?type=month_to_date&date=2026-10-15')
          .set('Cookie', userA.cookies);

        expect(res.status).toBe(200);
        expect(res.body.type).toBe('month_to_date');
        expect(res.body.selectedDate).toBe('2026-10-15');
        expect(res.body.dateFrom).toBe('2026-10-01');
        expect(res.body.dateTo).toBe('2026-10-15');

        // Sum = 360 / 3 = 120
        expect(res.body.stats).toEqual({
          count: 3,
          highest: 140,
          lowest: 100,
          average: 120,
        });

        // Spec: Month-to-date reports do not list slot readings
        expect(res.body.readings).toEqual([]);
      });
    });

    describe('Monthly Reports (type=monthly)', () => {
      it('aggregates readings for the whole previous month', async () => {
        // Readings out of boundary
        await addReading(userA, { date: '2026-08-31', slot: 'morning_fasting', value: 500 });
        await addReading(userA, { date: '2026-10-01', slot: 'morning_fasting', value: 500 });

        // Readings in previous month (September 2026: 2026-09-01 to 2026-09-30)
        await addReading(userA, { date: '2026-09-05', slot: 'morning_fasting', value: 110 });
        await addReading(userA, { date: '2026-09-25', slot: 'after_dinner', value: 130 });

        const res = await request(app)
          .get('/api/reports?type=monthly&date=2026-10-15')
          .set('Cookie', userA.cookies);

        expect(res.status).toBe(200);
        expect(res.body.type).toBe('monthly');
        expect(res.body.selectedDate).toBe('2026-10-15');
        expect(res.body.dateFrom).toBe('2026-09-01');
        expect(res.body.dateTo).toBe('2026-09-30');

        expect(res.body.stats).toEqual({
          count: 2,
          highest: 130,
          lowest: 110,
          average: 120,
        });

        expect(res.body.readings).toEqual([]);
      });

      it('handles January date correctly rolling back to previous year December', async () => {
        // Date in Jan 2026 -> previous month: 2025-12-01 to 2025-12-31
        await addReading(userA, { date: '2025-12-15', slot: 'after_lunch', value: 155 });
        await addReading(userA, { date: '2026-01-05', slot: 'after_lunch', value: 300 });

        const res = await request(app)
          .get('/api/reports?type=monthly&date=2026-01-10')
          .set('Cookie', userA.cookies);

        expect(res.status).toBe(200);
        expect(res.body.dateFrom).toBe('2025-12-01');
        expect(res.body.dateTo).toBe('2025-12-31');
        expect(res.body.stats).toEqual({
          count: 1,
          highest: 155,
          lowest: 155,
          average: 155,
        });
        expect(res.body.readings).toEqual([]);
      });
    });

    describe('Empty State Handling', () => {
      it('returns null stats and empty readings when count is 0', async () => {
        const res = await request(app)
          .get('/api/reports?type=daily&date=2026-05-15')
          .set('Cookie', userA.cookies);

        expect(res.status).toBe(200);
        expect(res.body.stats).toEqual({
          count: 0,
          highest: null,
          lowest: null,
          average: null,
        });
        expect(res.body.readings).toEqual([]);
      });
    });

    describe('Multi-Tenant IDOR & Data Isolation', () => {
      it('ensures User A and User B reports are strictly isolated', async () => {
        await addReading(userA, { date: '2026-10-15', slot: 'morning_fasting', value: 250 });
        await addReading(userB, { date: '2026-10-15', slot: 'morning_fasting', value: 85 });

        // User A's report
        const resA = await request(app)
          .get('/api/reports?type=daily&date=2026-10-15')
          .set('Cookie', userA.cookies);

        expect(resA.status).toBe(200);
        expect(resA.body.stats.count).toBe(1);
        expect(resA.body.stats.highest).toBe(250);
        expect(resA.body.stats.lowest).toBe(250);
        expect(resA.body.stats.average).toBe(250);
        expect(resA.body.readings[0].value).toBe(250);

        // User B's report
        const resB = await request(app)
          .get('/api/reports?type=daily&date=2026-10-15')
          .set('Cookie', userB.cookies);

        expect(resB.status).toBe(200);
        expect(resB.body.stats.count).toBe(1);
        expect(resB.body.stats.highest).toBe(85);
        expect(resB.body.stats.lowest).toBe(85);
        expect(resB.body.stats.average).toBe(85);
        expect(resB.body.readings[0].value).toBe(85);
      });
    });

    describe('Advanced Boundary & Edge Cases', () => {
      it('orders all 4 circadian meal slots in exact chronological sequence', async () => {
        // Insert all 4 slots in reverse chronological order
        await addReading(userA, { date: '2026-10-15', slot: 'after_dinner', value: 160 });
        await addReading(userA, { date: '2026-10-15', slot: 'after_lunch', value: 140 });
        await addReading(userA, { date: '2026-10-15', slot: 'after_breakfast', value: 120 });
        await addReading(userA, { date: '2026-10-15', slot: 'morning_fasting', value: 90 });

        const res = await request(app)
          .get('/api/reports?type=daily&date=2026-10-15')
          .set('Cookie', userA.cookies);

        expect(res.status).toBe(200);
        expect(res.body.readings).toHaveLength(4);
        expect(res.body.readings.map((r) => r.slot)).toEqual([
          'morning_fasting',
          'after_breakfast',
          'after_lunch',
          'after_dinner',
        ]);
        expect(res.body.stats).toEqual({
          count: 4,
          highest: 160,
          lowest: 90,
          average: 127.5,
        });
      });

      it('accurately verifies arithmetic rounding up and down to 1 decimal place', async () => {
        // [100, 100, 101] -> 301 / 3 = 100.333... -> 100.3 (round down)
        await addReading(userA, { date: '2026-06-01', slot: 'morning_fasting', value: 100 });
        await addReading(userA, { date: '2026-06-01', slot: 'after_breakfast', value: 100 });
        await addReading(userA, { date: '2026-06-01', slot: 'after_lunch', value: 101 });

        const resDown = await request(app)
          .get('/api/reports?type=daily&date=2026-06-01')
          .set('Cookie', userA.cookies);
        expect(resDown.body.stats.average).toBe(100.3);

        // [100, 100, 102] -> 302 / 3 = 100.666... -> 100.7 (round up)
        await addReading(userB, { date: '2026-06-01', slot: 'morning_fasting', value: 100 });
        await addReading(userB, { date: '2026-06-01', slot: 'after_breakfast', value: 100 });
        await addReading(userB, { date: '2026-06-01', slot: 'after_lunch', value: 102 });

        const resUp = await request(app)
          .get('/api/reports?type=daily&date=2026-06-01')
          .set('Cookie', userB.cookies);
        expect(resUp.body.stats.average).toBe(100.7);
      });

      it('includes leap day 2024-02-29 in monthly report when queried in March 2024', async () => {
        // 2024 is a leap year; Feb has 29 days
        await addReading(userA, { date: '2024-02-29', slot: 'morning_fasting', value: 115 });
        await addReading(userA, { date: '2024-03-01', slot: 'morning_fasting', value: 500 }); // excluded

        const res = await request(app)
          .get('/api/reports?type=monthly&date=2024-03-15')
          .set('Cookie', userA.cookies);

        expect(res.status).toBe(200);
        expect(res.body.dateFrom).toBe('2024-02-01');
        expect(res.body.dateTo).toBe('2024-02-29');
        expect(res.body.stats).toEqual({
          count: 1,
          highest: 115,
          lowest: 115,
          average: 115,
        });
      });

      it('handles whitespace date parameter by defaulting to today in IST', async () => {
        const today = getTodayInIST();
        await addReading(userA, { date: today, slot: 'morning_fasting', value: 99 });

        const res = await request(app)
          .get('/api/reports?type=daily&date=%20%20')
          .set('Cookie', userA.cookies);

        expect(res.status).toBe(200);
        expect(res.body.selectedDate).toBe(today);
        expect(res.body.stats.count).toBe(1);
        expect(res.body.stats.average).toBe(99);
      });

      it('defaults to today in IST for month_to_date when date parameter is omitted', async () => {
        const today = getTodayInIST();
        const [year, month] = today.split('-');
        const expectedFrom = `${year}-${month}-01`;

        await addReading(userA, { date: today, slot: 'morning_fasting', value: 112 });

        const res = await request(app)
          .get('/api/reports?type=month_to_date')
          .set('Cookie', userA.cookies);

        expect(res.status).toBe(200);
        expect(res.body.type).toBe('month_to_date');
        expect(res.body.selectedDate).toBe(today);
        expect(res.body.dateFrom).toBe(expectedFrom);
        expect(res.body.dateTo).toBe(today);
        expect(res.body.readings).toEqual([]);
      });

      it('defaults to today in IST for monthly when date parameter is omitted', async () => {
        const today = getTodayInIST();
        const [year, month] = today.split('-').map(Number);
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const daysInPrev = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
        const expectedFrom = `${String(prevYear).padStart(4, '0')}-${String(prevMonth).padStart(2, '0')}-01`;
        const expectedTo = `${String(prevYear).padStart(4, '0')}-${String(prevMonth).padStart(2, '0')}-${String(daysInPrev).padStart(2, '0')}`;

        const res = await request(app)
          .get('/api/reports?type=monthly')
          .set('Cookie', userA.cookies);

        expect(res.status).toBe(200);
        expect(res.body.type).toBe('monthly');
        expect(res.body.selectedDate).toBe(today);
        expect(res.body.dateFrom).toBe(expectedFrom);
        expect(res.body.dateTo).toBe(expectedTo);
        expect(res.body.readings).toEqual([]);
      });

      it('orders partial circadian meal slots correctly (skipping breakfast and lunch)', async () => {
        await addReading(userA, { date: '2026-10-15', slot: 'after_dinner', value: 175 });
        await addReading(userA, { date: '2026-10-15', slot: 'morning_fasting', value: 88 });

        const res = await request(app)
          .get('/api/reports?type=daily&date=2026-10-15')
          .set('Cookie', userA.cookies);

        expect(res.status).toBe(200);
        expect(res.body.readings).toHaveLength(2);
        expect(res.body.readings[0].slot).toBe('morning_fasting');
        expect(res.body.readings[1].slot).toBe('after_dinner');
      });

      it('rejects tampered or malformed access token with 401', async () => {
        const res = await request(app)
          .get('/api/reports?type=daily&date=2026-10-15')
          .set('Cookie', ['accessToken=invalid.token.signature']);

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid or expired token');
      });
    });
  });
});
