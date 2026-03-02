const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// SECURITY (1.18@SEC-1): Require DB_PASSWORD - no default fallback
const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) {
  throw new Error('[FATAL] DB_PASSWORD environment variable is required. Set DB_PASSWORD or DATABASE_URL with credentials.');
}

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cacheflow',
  user: process.env.DB_USER || 'cacheflow',
  password: dbPassword
});

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    if (res.fail) return res.fail('No token provided', 401);
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    // Attach tenant_id from DB — single query, cached by connection pool
    const result = await pool.query(
      'SELECT id, email, tenant_id, quota_bytes, used_bytes FROM users WHERE id=$1',
      [decoded.id]
    );
    if (!result.rows.length) {
      if (res.fail) return res.fail('User not found', 401);
      return res.status(401).json({ error: 'User not found' });
    }
    const user = result.rows[0];
    // Admin model: single ADMIN_EMAIL + optional QA allowlist (explicitly gated)
    const adminEmail = process.env.ADMIN_EMAIL;
    const qaEnabled = String(process.env.CACHEFLOW_QA_ADMIN_ENABLED || '').toLowerCase() === 'true';
    const qaEmails = String(process.env.CACHEFLOW_QA_ADMIN_EMAILS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    user.is_admin = (adminEmail && user.email === adminEmail) || (qaEnabled && qaEmails.includes(user.email));
    req.user = user;
    next();
  } catch (err) {
    if (res.fail) return res.fail('Invalid or expired token', 401);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
