const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Write an audit log entry
 * Note: Audit failure must never block the main request
 */
async function auditLog(userId, action, resource, resourceId, req, metadata = {}) {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
              || req.socket?.remoteAddress
              || 'unknown';
    const userAgent = (req.headers['user-agent'] || '').slice(0, 255);

    // Emit console log for observability in docker logs
    console.log(`[audit] action=${action} resource=${resource} resourceId=${resourceId} userId=${userId}`);

    await pool.query(
      `INSERT INTO audit_logs
         (user_id, action, resource, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, resource, resourceId, ip, userAgent, JSON.stringify(metadata)]
    );
  } catch (err) {
    // Audit failure must never block the main request
    console.error('[audit] Failed to write audit log:', err.message);
  }
}

/**
 * Middleware to auto-log requests (optional - for debugging)
 */
function auditMiddleware(req, res, next) {
  // Store start time for duration tracking
  req._auditStart = Date.now();

  // Capture response finish to log after
  res.on('finish', () => {
    const duration = Date.now() - req._auditStart;
    if (req.user?.id) {
      // Log basic request info (detailed logging done in route handlers)
      console.log(`[audit] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });

  next();
}

module.exports = { auditLog, auditMiddleware };

