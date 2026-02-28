const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cacheflow',
  user: process.env.DB_USER || 'cacheflow',
  password: process.env.DB_PASSWORD || 'changeme123'
});

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    // Attach tenant_id from DB — single query, cached by connection pool
    const result = await pool.query(
      'SELECT id, email, tenant_id, quota_bytes, used_bytes FROM users WHERE id=$1',
      [decoded.id]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'User not found' });
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
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
