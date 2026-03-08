require('dotenv').config();
const config = require('./config');
const encryption = require('./services/encryption');

// Ensure encryption key is valid before starting
if (!encryption.isValidHexKey(process.env.TOKEN_ENCRYPTION_KEY)) {
  console.error('[FATAL] TOKEN_ENCRYPTION_KEY must be a 64-character hex string.');
  process.exit(1);
}

// Global safety net to prevent crashes from unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection — process kept alive:', reason);
  // Log but DO NOT exit — let the request fail gracefully
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception — process kept alive:', err);
});

const app  = require('./app');
const PORT = config.port;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function seedTestUser() {
  const enabled = String(process.env.CACHEFLOW_TEST_USER_SEED || '').toLowerCase() === 'true';
  const email = normalizeEmail(process.env.CACHEFLOW_TEST_USER_EMAIL);
  const password = process.env.CACHEFLOW_TEST_USER_PASSWORD;
  if (!enabled || !email || !password) return;

  const pool = require('./db/client');
  const bcrypt = require('bcryptjs');

  try {
    const exists = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
    if (exists.rows.length) {
      console.log('[seed] test user already exists:', email);
      return;
    }
    if (password.length < 8) {
      console.warn('[seed] test user password too short; skipping');
      return;
    }
    const hash = await bcrypt.hash(password, 12);
    await pool.query('INSERT INTO users (email, password_hash) VALUES ($1,$2)', [email, hash]);
    console.log('[seed] created test user:', email);
  } catch (err) {
    console.error('[seed] failed creating test user:', err.message);
  }
}

seedTestUser();

app.listen(PORT, () => {
  console.log(`[cacheflow] API listening on port ${PORT}`);
});

