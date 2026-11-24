const path = require('path');

// Preserve explicitly set NODE_ENV (such as 'test' from Jest)
const explicitNodeEnv = process.env.NODE_ENV;

// Load environment variables: check project root .env first, then server/.env
const rootEnvPath = path.resolve(__dirname, '../../../.env');
const serverEnvPath = path.resolve(__dirname, '../../.env');

require('dotenv').config({ path: rootEnvPath });
require('dotenv').config({ path: serverEnvPath, override: true });

// Restore explicit NODE_ENV if it was set prior to loading .env
if (explicitNodeEnv) {
  process.env.NODE_ENV = explicitNodeEnv;
}

const env = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://sweety_user:sweety_password@localhost:5432/sweety_db',
  JWT_SECRET: process.env.JWT_SECRET || 'sweety_super_secret_jwt_key_at_least_32_characters_long_for_security',
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  USE_IN_MEMORY_DB: process.env.USE_IN_MEMORY_DB !== undefined 
    ? process.env.USE_IN_MEMORY_DB === 'true' 
    : process.env.NODE_ENV === 'test',
};

module.exports = env;
