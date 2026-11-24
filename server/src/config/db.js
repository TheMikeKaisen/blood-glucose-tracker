const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');
const env = require('./env');

// Force DATE column (OID 1082) to parse as raw 'YYYY-MM-DD' string to prevent timezone day-shift
types.setTypeParser(1082, (val) => val);

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
  
  // Register plpgsql script language handler for DO $$ blocks
  memDbInstance.registerLanguage('plpgsql', ({ code }) => () => {
    const match = code.match(/CREATE\s+TYPE\s+([a-zA-Z0-9_]+)\s+AS\s+ENUM\s*\(([^)]+)\)/i);
    if (match) {
      try {
        memDbInstance.public.none(match[0] + ';');
      } catch (e) {
        // Ignore duplicate type creation errors
      }
    }
  });

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
    try {
      await pool.query('DELETE FROM readings;');
    } catch (e) {
      // Table might not exist yet
    }
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
