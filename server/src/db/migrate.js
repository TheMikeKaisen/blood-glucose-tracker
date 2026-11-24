const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');

async function runMigrations() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await query(schemaSql);
  return true;
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Database migration applied successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database migration failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
