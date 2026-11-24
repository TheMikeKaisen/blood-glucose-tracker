const { pool, query } = require('../src/config/db');
const { runMigrations } = require('../src/db/migrate');

describe('Database Migration', () => {
  afterAll(async () => {
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  });

  it('successfully creates the users table with appropriate columns', async () => {
    await runMigrations();
    const res = await query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'users';`
    );
    const columns = res.rows.map((r) => r.column_name);
    expect(columns).toContain('id');
    expect(columns).toContain('name');
    expect(columns).toContain('email');
    expect(columns).toContain('password_hash');
    expect(columns).toContain('created_at');
  });

  it('successfully creates the refresh_tokens table with appropriate columns', async () => {
    await runMigrations();
    const res = await query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'refresh_tokens';`
    );
    const columns = res.rows.map((r) => r.column_name);
    expect(columns).toContain('id');
    expect(columns).toContain('user_id');
    expect(columns).toContain('token_hash');
    expect(columns).toContain('expires_at');
    expect(columns).toContain('revoked_at');
  });
});
