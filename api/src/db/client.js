const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] idle client error:', err.message);
});

module.exports = pool;
