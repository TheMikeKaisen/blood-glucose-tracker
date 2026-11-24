const request = require('supertest');
const app = require('../src/app');
const { pool, resetTestDb } = require('../src/config/db');

describe('Readings API Integration Tests (Phase 2)', () => {
  let userA, userB;

  // Helper to create and authenticate a user
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

  describe('Authentication Enforcement', () => {
    it('rejects unauthenticated requests to all endpoints with 401', async () => {
      const getRes = await request(app).get('/api/readings');
      expect(getRes.status).toBe(401);
      expect(getRes.body.error).toBe('Authentication required');

      const postRes = await request(app)
        .post('/api/readings')
        .send({ date: '2026-10-15', slot: 'after_lunch', value: 120 });
      expect(postRes.status).toBe(401);

      const putRes = await request(app)
        .put('/api/readings/1')
        .send({ date: '2026-10-15', slot: 'after_lunch', value: 120 });
      expect(putRes.status).toBe(401);

      const patchRes = await request(app)
        .patch('/api/readings/1')
        .send({ value: 130 });
      expect(patchRes.status).toBe(401);

      const delRes = await request(app).delete('/api/readings/1');
      expect(delRes.status).toBe(401);
    });
  });

  describe('POST /api/readings (Creation & Exact Validation Rules)', () => {
    const validReading = {
      date: '2026-10-15',
      slot: 'after_lunch',
      value: 125,
    };

    it('successfully creates reading with valid inputs and returns 201', async () => {
      const res = await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send(validReading);

      expect(res.status).toBe(201);
      expect(res.body.reading).toBeDefined();
      expect(res.body.reading.id).toBeDefined();
      expect(res.body.reading.date).toBe('2026-10-15');
      expect(res.body.reading.slot).toBe('after_lunch');
      expect(res.body.reading.value).toBe(125);
      expect(res.body.reading.createdAt).toBeDefined();
      expect(res.body.reading.updatedAt).toBeDefined();
    });

    it('accepts boundary values 40 and 600 mg/dl', async () => {
      const res40 = await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'morning_fasting', value: 40 });
      expect(res40.status).toBe(201);
      expect(res40.body.reading.value).toBe(40);

      const res600 = await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'after_breakfast', value: 600 });
      expect(res600.status).toBe(201);
      expect(res600.body.reading.value).toBe(600);
    });

    it('rejects missing or empty glucose value with exact error: "Please enter a glucose value."', async () => {
      const resMissing = await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'after_lunch' });

      expect(resMissing.status).toBe(422);
      expect(resMissing.body.error).toBe('Please enter a glucose value.');

      const resEmpty = await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'after_lunch', value: '' });

      expect(resEmpty.status).toBe(422);
      expect(resEmpty.body.error).toBe('Please enter a glucose value.');

      const resNull = await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'after_lunch', value: null });

      expect(resNull.status).toBe(422);
      expect(resNull.body.error).toBe('Please enter a glucose value.');

      const resWhitespace = await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'after_lunch', value: '   ' });

      expect(resWhitespace.status).toBe(422);
      expect(resWhitespace.body.error).toBe('Please enter a glucose value.');
    });

    it('rejects out of range, decimals, or non-integer values with exact error: "Value must be between 40 and 600 mg/dl."', async () => {
      const invalidValues = [39, 601, 120.5, 'abc', 0, -50];

      for (const val of invalidValues) {
        const res = await request(app)
          .post('/api/readings')
          .set('Cookie', userA.cookies)
          .set('X-CSRF-Token', userA.csrfToken)
          .send({ date: '2026-10-15', slot: 'after_lunch', value: val });

        expect(res.status).toBe(422);
        expect(res.body.error).toBe('Value must be between 40 and 600 mg/dl.');
      }
    });

    it('rejects future dates relative to IST with exact error: "Date cannot be in the future."', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 3);
      const futureDateStr = future.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: futureDateStr, slot: 'after_lunch', value: 110 });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Date cannot be in the future.');
    });

    it('rejects duplicate slot on same date with exact error: "You already have an {Slot Name} reading for this date."', async () => {
      await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'after_lunch', value: 120 });

      const resDuplicate = await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'after_lunch', value: 135 });

      expect(resDuplicate.status).toBe(409);
      expect(resDuplicate.body.error).toBe('You already have an After lunch reading for this date.');
    });

    it('rejects more than 4 readings per day with exact error: "You can add only 4 readings per day."', async () => {
      const slots = ['morning_fasting', 'after_breakfast', 'after_lunch', 'after_dinner'];
      const testDate = '2026-10-15';

      // Insert all 4 slots
      for (const slot of slots) {
        const res = await request(app)
          .post('/api/readings')
          .set('Cookie', userA.cookies)
          .set('X-CSRF-Token', userA.csrfToken)
          .send({ date: testDate, slot, value: 110 });
        expect(res.status).toBe(201);
      }

      // Attempt 5th reading on same date
      const res5th = await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: testDate, slot: 'morning_fasting', value: 115 });

      expect(res5th.status).toBe(409);
      expect(res5th.body.error).toBe('You can add only 4 readings per day.');
    });

    it('handles concurrent identical slot insertions safely via PostgreSQL unique constraint', async () => {
      const payload = { date: '2026-10-16', slot: 'after_dinner', value: 140 };

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/readings')
          .set('Cookie', userA.cookies)
          .set('X-CSRF-Token', userA.csrfToken)
          .send(payload),
        request(app)
          .post('/api/readings')
          .set('Cookie', userA.cookies)
          .set('X-CSRF-Token', userA.csrfToken)
          .send(payload),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);
      const conflictRes = res1.status === 409 ? res1 : res2;
      expect(conflictRes.body.error).toBe('You already have an After dinner reading for this date.');
    });
  });

  describe('GET /api/readings (Daily & Paginated Views)', () => {
    beforeEach(async () => {
      // Seed userA with 4 readings on 2026-10-15 in mixed order
      const readings = [
        { date: '2026-10-15', slot: 'after_dinner', value: 150 },
        { date: '2026-10-15', slot: 'morning_fasting', value: 85 },
        { date: '2026-10-15', slot: 'after_lunch', value: 130 },
        { date: '2026-10-15', slot: 'after_breakfast', value: 120 },
        // Reading on previous day
        { date: '2026-10-14', slot: 'after_lunch', value: 128 },
      ];

      for (const r of readings) {
        await request(app)
          .post('/api/readings')
          .set('Cookie', userA.cookies)
          .set('X-CSRF-Token', userA.csrfToken)
          .send(r);
      }
    });

    it('returns daily readings sorted strictly chronologically by meal slot', async () => {
      const res = await request(app)
        .get('/api/readings?date=2026-10-15')
        .set('Cookie', userA.cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data).toHaveLength(4);

      const slots = res.body.data.map((r) => r.slot);
      expect(slots).toEqual([
        'morning_fasting',
        'after_breakfast',
        'after_lunch',
        'after_dinner',
      ]);
    });

    it('returns empty array when no readings exist for requested date', async () => {
      const res = await request(app)
        .get('/api/readings?date=2026-01-01')
        .set('Cookie', userA.cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('rejects invalid calendar dates in date query parameter with 422', async () => {
      const res = await request(app)
        .get('/api/readings?date=2026-02-31')
        .set('Cookie', userA.cookies);

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Please provide a valid date in YYYY-MM-DD format.');
    });

    it('falls back to paginated list when date query param is empty string', async () => {
      const res = await request(app)
        .get('/api/readings?date=&page=&limit=')
        .set('Cookie', userA.cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.pagination).toBeDefined();
    });

    it('returns paginated readings list with pagination envelope when no date is passed', async () => {
      const res = await request(app)
        .get('/api/readings?page=1&limit=3')
        .set('Cookie', userA.cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(3);
      expect(res.body.pagination.total).toBe(5);
      expect(res.body.pagination.totalPages).toBe(2);
    });

    it('paginates to page 2 correctly', async () => {
      const res = await request(app)
        .get('/api/readings?page=2&limit=3')
        .set('Cookie', userA.cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.page).toBe(2);
    });
  });

  describe('GET /api/readings/:id', () => {
    it('returns single reading when found and owned by user', async () => {
      const createRes = await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'morning_fasting', value: 92 });

      const readingId = createRes.body.reading.id;

      const res = await request(app)
        .get(`/api/readings/${readingId}`)
        .set('Cookie', userA.cookies);

      expect(res.status).toBe(200);
      expect(res.body.reading).toBeDefined();
      expect(res.body.reading.id).toBe(readingId);
      expect(res.body.reading.value).toBe(92);
      expect(res.body.reading.slot).toBe('morning_fasting');
    });

    it('returns 404 when reading ID does not exist', async () => {
      const res = await request(app)
        .get('/api/readings/999999')
        .set('Cookie', userA.cookies);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Reading not found');
    });

    it('returns 404 cleanly when reading ID is non-numeric, zero, negative, or overflows bigint without 500 error', async () => {
      const invalidIds = ['abc', '0', '-5', '1.5', '999999999999999999999999999999'];
      for (const id of invalidIds) {
        const res = await request(app)
          .get(`/api/readings/${id}`)
          .set('Cookie', userA.cookies);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Reading not found');
      }
    });
  });

  describe('PUT /api/readings/:id (Full Replacement Update)', () => {
    let readingId;

    beforeEach(async () => {
      // Create reading
      const res = await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'morning_fasting', value: 90 });
      readingId = res.body.reading.id;
    });

    it('successfully replaces reading attributes', async () => {
      const res = await request(app)
        .put(`/api/readings/${readingId}`)
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'after_breakfast', value: 135 });

      expect(res.status).toBe(200);
      expect(res.body.reading.value).toBe(135);
      expect(res.body.reading.slot).toBe('after_breakfast');
    });

    it('updates a reading on a date with 4 readings without triggering daily limit false rejection', async () => {
      // Add other 3 readings on same date
      const otherSlots = ['after_breakfast', 'after_lunch', 'after_dinner'];
      for (const slot of otherSlots) {
        await request(app)
          .post('/api/readings')
          .set('Cookie', userA.cookies)
          .set('X-CSRF-Token', userA.csrfToken)
          .send({ date: '2026-10-15', slot, value: 120 });
      }

      // Update the original reading value without changing slot or date
      const res = await request(app)
        .put(`/api/readings/${readingId}`)
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'morning_fasting', value: 95 });

      expect(res.status).toBe(200);
      expect(res.body.reading.value).toBe(95);
    });

    it('rejects changing slot to an already existing slot on that date', async () => {
      // Add after_lunch reading
      await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'after_lunch', value: 130 });

      // Try updating morning_fasting reading to after_lunch
      const res = await request(app)
        .put(`/api/readings/${readingId}`)
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'after_lunch', value: 130 });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('You already have an After lunch reading for this date.');
    });

    it('returns 404 for non-existent reading ID', async () => {
      const res = await request(app)
        .put('/api/readings/999999')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'morning_fasting', value: 100 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Reading not found');
    });

    it('returns 404 cleanly when PUT reading ID is non-numeric', async () => {
      const res = await request(app)
        .put('/api/readings/abc')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'morning_fasting', value: 100 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Reading not found');
    });

    it('rejects moving reading to another date via PUT if that target date already has 4 readings', async () => {
      const targetDate = '2026-10-16';
      const slots = ['morning_fasting', 'after_breakfast', 'after_lunch', 'after_dinner'];
      for (const slot of slots) {
        await request(app)
          .post('/api/readings')
          .set('Cookie', userA.cookies)
          .set('X-CSRF-Token', userA.csrfToken)
          .send({ date: targetDate, slot, value: 105 });
      }

      // Attempt to move readingId from 2026-10-15 to 2026-10-16
      const res = await request(app)
        .put(`/api/readings/${readingId}`)
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: targetDate, slot: 'morning_fasting', value: 110 });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('You can add only 4 readings per day.');
    });
  });

  describe('PATCH /api/readings/:id (Partial Update)', () => {
    let readingId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'morning_fasting', value: 90 });
      readingId = res.body.reading.id;
    });

    it('partially updates value only', async () => {
      const res = await request(app)
        .patch(`/api/readings/${readingId}`)
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ value: 105 });

      expect(res.status).toBe(200);
      expect(res.body.reading.value).toBe(105);
      expect(res.body.reading.slot).toBe('morning_fasting');
      expect(res.body.reading.date).toBe('2026-10-15');
    });

    it('partially updates slot only', async () => {
      const res = await request(app)
        .patch(`/api/readings/${readingId}`)
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ slot: 'after_breakfast' });

      expect(res.status).toBe(200);
      expect(res.body.reading.slot).toBe('after_breakfast');
      expect(res.body.reading.value).toBe(90);
    });

    it('rejects empty PATCH payload with 422', async () => {
      const res = await request(app)
        .patch(`/api/readings/${readingId}`)
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('At least one field must be provided for update.');
    });

    it('returns 404 for non-existent reading ID', async () => {
      const res = await request(app)
        .patch('/api/readings/999999')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ value: 110 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Reading not found');
    });

    it('returns 404 cleanly when PATCH reading ID is non-numeric', async () => {
      const res = await request(app)
        .patch('/api/readings/abc')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ value: 110 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Reading not found');
    });

    it('rejects whitespace glucose value in PATCH with exact error', async () => {
      const res = await request(app)
        .patch(`/api/readings/${readingId}`)
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ value: '   ' });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Please enter a glucose value.');
    });

    it('rejects moving reading to another date via PATCH if target date has 4 readings', async () => {
      const targetDate = '2026-10-17';
      const slots = ['morning_fasting', 'after_breakfast', 'after_lunch', 'after_dinner'];
      for (const slot of slots) {
        await request(app)
          .post('/api/readings')
          .set('Cookie', userA.cookies)
          .set('X-CSRF-Token', userA.csrfToken)
          .send({ date: targetDate, slot, value: 100 });
      }

      const res = await request(app)
        .patch(`/api/readings/${readingId}`)
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: targetDate });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('You can add only 4 readings per day.');
    });

    it('rejects moving reading to another date via PATCH if slot already exists on target date', async () => {
      const targetDate = '2026-10-18';
      // Add morning_fasting on 2026-10-18
      await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: targetDate, slot: 'morning_fasting', value: 95 });

      // readingId on 2026-10-15 is morning_fasting; patching date to 2026-10-18 creates duplicate morning_fasting
      const res = await request(app)
        .patch(`/api/readings/${readingId}`)
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: targetDate });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('You already have an Morning (fasting) reading for this date.');
    });
  });

  describe('DELETE /api/readings/:id', () => {
    it('successfully deletes an existing reading', async () => {
      const createRes = await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'morning_fasting', value: 90 });

      const readingId = createRes.body.reading.id;

      const delRes = await request(app)
        .delete(`/api/readings/${readingId}`)
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken);

      expect(delRes.status).toBe(200);
      expect(delRes.body.message).toBe('Reading deleted successfully');

      // Verify it is gone
      const checkRes = await request(app)
        .get(`/api/readings/${readingId}`)
        .set('Cookie', userA.cookies);
      expect(checkRes.status).toBe(404);
    });

    it('returns 404 when deleting a non-existent reading', async () => {
      const res = await request(app)
        .delete('/api/readings/999999')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Reading not found');
    });

    it('returns 404 cleanly when deleting reading with non-numeric ID', async () => {
      const res = await request(app)
        .delete('/api/readings/abc')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Reading not found');
    });
  });

  describe('Multi-Tenant IDOR Protection', () => {
    let readingAId;

    beforeEach(async () => {
      // User A creates a reading
      const res = await request(app)
        .post('/api/readings')
        .set('Cookie', userA.cookies)
        .set('X-CSRF-Token', userA.csrfToken)
        .send({ date: '2026-10-15', slot: 'after_lunch', value: 140 });
      readingAId = res.body.reading.id;
    });

    it('prevents User B from reading User A reading (IDOR GET returns 404)', async () => {
      const res = await request(app)
        .get(`/api/readings/${readingAId}`)
        .set('Cookie', userB.cookies);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Reading not found');
    });

    it('prevents User B from replacing User A reading (IDOR PUT returns 404)', async () => {
      const res = await request(app)
        .put(`/api/readings/${readingAId}`)
        .set('Cookie', userB.cookies)
        .set('X-CSRF-Token', userB.csrfToken)
        .send({ date: '2026-10-15', slot: 'after_lunch', value: 99 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Reading not found');

      // Verify User A reading was NOT modified
      const checkRes = await request(app)
        .get(`/api/readings/${readingAId}`)
        .set('Cookie', userA.cookies);
      expect(checkRes.body.reading.value).toBe(140);
    });

    it('prevents User B from patching User A reading (IDOR PATCH returns 404)', async () => {
      const res = await request(app)
        .patch(`/api/readings/${readingAId}`)
        .set('Cookie', userB.cookies)
        .set('X-CSRF-Token', userB.csrfToken)
        .send({ value: 99 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Reading not found');

      // Verify User A reading was NOT modified
      const checkRes = await request(app)
        .get(`/api/readings/${readingAId}`)
        .set('Cookie', userA.cookies);
      expect(checkRes.body.reading.value).toBe(140);
    });

    it('prevents User B from deleting User A reading (IDOR DELETE returns 404)', async () => {
      const res = await request(app)
        .delete(`/api/readings/${readingAId}`)
        .set('Cookie', userB.cookies)
        .set('X-CSRF-Token', userB.csrfToken);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Reading not found');

      // Verify User A reading still exists
      const checkRes = await request(app)
        .get(`/api/readings/${readingAId}`)
        .set('Cookie', userA.cookies);
      expect(checkRes.status).toBe(200);
      expect(checkRes.body.reading.value).toBe(140);
    });

    it('isolates reading lists: User B does not see User A readings in GET /api/readings', async () => {
      // User B checks list
      const listRes = await request(app)
        .get('/api/readings?date=2026-10-15')
        .set('Cookie', userB.cookies);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(0);
    });
  });
});
