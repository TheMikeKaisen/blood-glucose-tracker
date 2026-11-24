const { pool, query, isInMemory } = require('../src/config/db');

describe('Database Configuration', () => {
  afterAll(async () => {
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  });

  it('exports a query function and pool instance', () => {
    expect(typeof query).toBe('function');
    expect(pool).toBeDefined();
    expect(typeof pool.query).toBe('function');
  });

  it('can execute a basic SELECT query', async () => {
    const res = await query('SELECT 1 as result;');
    expect(res).toBeDefined();
    expect(res.rows[0].result).toBe(1);
  });
});
