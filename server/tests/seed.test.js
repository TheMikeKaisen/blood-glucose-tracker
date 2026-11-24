const { pool, query, resetTestDb } = require('../src/config/db');
const { seedDatabase } = require('../src/db/seed');

describe('Database Seeder', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  });

  it('creates the demo user (Priya Sharma, demo@sweety.dev) successfully', async () => {
    const result = await seedDatabase();
    expect(result).toBeDefined();
    expect(result.email).toBe('demo@sweety.dev');
    expect(result.userId).toBeDefined();

    const userRes = await query('SELECT id, name, email FROM users WHERE LOWER(email) = $1;', [
      'demo@sweety.dev',
    ]);
    expect(userRes.rows.length).toBe(1);
    expect(userRes.rows[0].name).toBe('Priya Sharma');
  });

  it('is idempotent: running multiple times does not produce errors or duplicates', async () => {
    await seedDatabase();
    await seedDatabase();

    const countRes = await query(
      'SELECT COUNT(*)::int as count FROM users WHERE LOWER(email) = $1;',
      ['demo@sweety.dev']
    );
    expect(countRes.rows[0].count).toBe(1);
  });
});
