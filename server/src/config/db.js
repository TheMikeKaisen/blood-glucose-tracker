const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const env = require('./env');

let pool;
let isInMemory = false;
let memDbInstance = null;

let schemaInitPromise = null;

async function initSchema() {
  if (!isInMemory) return;
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      const schemaPath = path.join(__dirname, '../db/schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSql);
      }
    })();
  }
  return schemaInitPromise;
}

if (env.USE_IN_MEMORY_DB) {
  const { newDb } = require('pg-mem');
  memDbInstance = newDb({ noAstCoverageCheck: true });
  
  // Register common Postgres functions if needed
  memDbInstance.public.registerFunction({
    name: 'current_timestamp',
    returns: 'timestamptz',
    implementation: () => new Date(),
  });

  const MemPg = memDbInstance.adapters.createPg();
  pool = new MemPg.Pool();
  isInMemory = true;

  // Trigger schema initialization
  initSchema().catch((err) => {
    console.error('Failed to initialize in-memory test database schema:', err);
  });
} else {
  pool = new Pool({
    connectionString: env.DATABASE_URL,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
    process.exit(-1);
  });
}

/**
 * Resets the test database tables between test suites
 */
async function resetTestDb() {
  if (isInMemory || env.NODE_ENV === 'test') {
    await initSchema();
    await pool.query('DELETE FROM refresh_tokens;');
    await pool.query('DELETE FROM users;');
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  isInMemory,
  initSchema,
  resetTestDb,
};
