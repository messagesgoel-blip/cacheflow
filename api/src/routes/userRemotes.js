const express = require('express');
const pool = require('../db/client');
const authMw = require('../middleware/auth');
const encryption = require('../services/encryption');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
router.use(authMw);

/**
 * GET /api/remotes - Get all remotes for current user
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, provider, account_key, account_id, account_email, display_name, expires_at, disabled, created_at, updated_at, last_used_at
       FROM user_remotes
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    
    // We return ok: true and data: rows to match the new production-grade contract
    res.ok({ remotes: result.rows });
  } catch (err) {
    console.error(`[remotes] GET error [${req.requestId}]:`, err.message);
    res.fail('Failed to retrieve remotes', 500);
  }
});

/**
 * POST /api/remotes - Upsert a remote account
 * Body: { provider, accountKey, accessToken, refreshToken, expiresAt, accountId, accountEmail, displayName }
 */
router.post('/', async (req, res) => {
  const { 
    provider, accountKey, accessToken, refreshToken, 
    expiresAt, accountId, accountEmail, displayName 
  } = req.body;

  if (!provider || !accountKey || !accessToken) {
    return res.fail('provider, accountKey and accessToken are required', 400);
  }

  try {
    const accessTokenEnc = encryption.encrypt(accessToken);
    const refreshTokenEnc = refreshToken ? encryption.encrypt(refreshToken) : null;
    
    const result = await pool.query(
      `INSERT INTO user_remotes (
        user_id, provider, account_key, account_id, account_email, 
        display_name, access_token_enc, refresh_token_enc, 
        expires_at, key_version, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (user_id, provider, account_key)
      DO UPDATE SET
        account_id = EXCLUDED.account_id,
        account_email = EXCLUDED.account_email,
        display_name = EXCLUDED.display_name,
        access_token_enc = EXCLUDED.access_token_enc,
        refresh_token_enc = COALESCE(EXCLUDED.refresh_token_enc, user_remotes.refresh_token_enc),
        expires_at = EXCLUDED.expires_at,
        key_version = EXCLUDED.key_version,
        updated_at = NOW(),
        disabled = FALSE
      RETURNING id, provider, account_key, display_name`,
      [
        req.user.id, provider, accountKey, accountId, accountEmail,
        displayName, accessTokenEnc, refreshTokenEnc,
        expiresAt ? new Date(expiresAt) : null,
        encryption.KEY_VERSION
      ]
    );

    const remote = result.rows[0];
    await auditLog(req.user.id, 'remote_connect', 'remote', remote.id, req, { provider, accountKey });
    
    res.ok({ remote });
  } catch (err) {
    console.error(`[remotes] POST error [${req.requestId}]:`, err.message);
    res.fail('Failed to save remote account', 500);
  }
});

/**
 * PATCH /api/remotes/:id - Update metadata
 */
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { displayName, disabled } = req.body;

  try {
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (displayName !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(displayName);
    }

    if (disabled !== undefined) {
      updates.push(`disabled = $${paramCount++}`);
      values.push(disabled);
    }

    if (updates.length === 0) {
      return res.fail('No updates provided', 400);
    }

    values.push(id, req.user.id);
    const result = await pool.query(
      `UPDATE user_remotes
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount++} AND user_id = $${paramCount}
       RETURNING id, provider, account_key, display_name, disabled`,
      values
    );

    if (result.rowCount === 0) {
      return res.fail('Remote not found', 404);
    }

    res.ok({ remote: result.rows[0] });
  } catch (err) {
    console.error(`[remotes] PATCH error [${req.requestId}]:`, err.message);
    res.fail('Failed to update remote', 500);
  }
});

/**
 * DELETE /api/remotes/:id - Disconnect remote
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM user_remotes WHERE id = $1 AND user_id = $2 RETURNING id, provider, account_key`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.fail('Remote not found', 404);
    }

    const remote = result.rows[0];
    await auditLog(req.user.id, 'remote_disconnect', 'remote', id, req, { provider: remote.provider, accountKey: remote.account_key });

    res.ok({ success: true, id });
  } catch (err) {
    console.error(`[remotes] DELETE error [${req.requestId}]:`, err.message);
    res.fail('Failed to disconnect remote', 500);
  }
});

/**
 * POST /api/remotes/:id/refresh - Refresh token server-side (Stub for now)
 * This would call the provider's OAuth refresh endpoint
 */
router.post('/:id/refresh', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT * FROM user_remotes WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.fail('Remote not found', 404);
    }

    const remote = result.rows[0];
    // TODO: Implement actual OAuth refresh logic per provider
    // This is a placeholder that simulates success
    
    await auditLog(req.user.id, 'remote_refresh', 'remote', id, req, { provider: remote.provider });
    
    res.ok({ refreshed: true });
  } catch (err) {
    console.error(`[remotes] refresh error [${req.requestId}]:`, err.message);
    res.fail('Failed to refresh token', 500);
  }
});

/**
 * POST /api/remotes/sync-from-client - One-time migration endpoint
 * Body: { tokens: [ { provider, accountKey, accessToken, refreshToken, expiresAt, accountId, accountEmail, displayName } ] }
 */
router.post('/sync-from-client', async (req, res) => {
  const { tokens } = req.body;

  if (!Array.isArray(tokens)) {
    return res.fail('tokens array required', 400);
  }

  const results = [];
  const errors = [];

  for (const token of tokens) {
    try {
      const { 
        provider, accountKey, accessToken, refreshToken, 
        expiresAt, accountId, accountEmail, displayName 
      } = token;

      if (!provider || !accountKey || !accessToken) {
        errors.push({ token, error: 'Missing required fields' });
        continue;
      }

      const accessTokenEnc = encryption.encrypt(accessToken);
      const refreshTokenEnc = refreshToken ? encryption.encrypt(refreshToken) : null;

      await pool.query(
        `INSERT INTO user_remotes (
          user_id, provider, account_key, account_id, account_email, 
          display_name, access_token_enc, refresh_token_enc, 
          expires_at, key_version, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (user_id, provider, account_key)
        DO UPDATE SET
          account_id = EXCLUDED.account_id,
          account_email = EXCLUDED.account_email,
          display_name = EXCLUDED.display_name,
          access_token_enc = EXCLUDED.access_token_enc,
          refresh_token_enc = COALESCE(EXCLUDED.refresh_token_enc, user_remotes.refresh_token_enc),
          expires_at = EXCLUDED.expires_at,
          key_version = EXCLUDED.key_version,
          updated_at = NOW(),
          disabled = FALSE`,
        [
          req.user.id, provider, accountKey, accountId, accountEmail,
          displayName, accessTokenEnc, refreshTokenEnc,
          expiresAt ? new Date(expiresAt) : null,
          encryption.KEY_VERSION
        ]
      );
      results.push({ provider, accountKey });
    } catch (err) {
      errors.push({ token, error: err.message });
    }
  }

  res.ok({ synced: results, errors: errors.length > 0 ? errors : undefined });
});

/**
 * GET /api/remotes/:id/health - Check health of a remote
 */
router.get('/:id/health', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT access_token_enc, provider, account_key, display_name FROM user_remotes WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) return res.fail('Remote not found', 404);

    const remote = result.rows[0];
    const accessToken = encryption.decrypt(remote.access_token_enc);

    // Actual health check: try a lightweight API call
    // For now, we'll return connected if we have a token
    res.ok({ status: 'connected' });
  } catch (err) {
    console.error(`[remotes] health error [${req.requestId}]:`, err.message);
    res.fail('Health check failed', 500);
  }
});

/**
 * POST /api/remotes/:id/proxy - Proxy a request to the provider API
 * Body: { method, url, headers, body }
 */
router.post('/:id/proxy', async (req, res) => {
  const { id } = req.params;
  const { method, url, headers = {}, body } = req.body;

  if (!url) return res.fail('URL is required', 400);

  try {
    const result = await pool.query(
      `SELECT access_token_enc, provider FROM user_remotes WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) return res.fail('Remote not found', 404);

    const accessToken = encryption.decrypt(result.rows[0].access_token_enc);

    // Prepare headers
    const proxyHeaders = { ...headers };
    proxyHeaders['Authorization'] = `Bearer ${accessToken}`;
    
    // Some providers might need specific headers or have specific URL requirements
    // For now we assume Bearer token works for most (Google, Dropbox, etc.)

    const response = await fetch(url, {
      method: method || 'GET',
      headers: proxyHeaders,
      body: body ? (typeof body === 'object' ? JSON.stringify(body) : body) : undefined
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      const disposition = response.headers.get('content-disposition');
      if (disposition) {
        res.setHeader('Content-Disposition', disposition);
      }
      res.status(response.status).send(buffer);
    }
  } catch (err) {
    console.error(`[remotes] proxy error [${req.requestId}]:`, err.message);
    res.fail('Proxy request failed: ' + err.message, 500);
  }
});

module.exports = router;
