/**
 * Token Storage API
 * Server-side encrypted token storage for optional backup
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db/client');
const authMw = require('../middleware/auth');

// Encryption key from environment
const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_SECRET || 'cacheflow-tokens-key';
const ALGORITHM = 'aes-256-gcm';

// ============================================================================
// ENCRYPTION HELPERS
// ============================================================================

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.repeat(Math.ceil(32 / ENCRYPTION_KEY.length))).slice(0, 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return iv.toString('hex') + ':' + authTag + ':' + encrypted;
}

function decrypt(encryptedText) {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const key = Buffer.from(ENCRYPTION_KEY.repeat(Math.ceil(32 / ENCRYPTION_KEY.length))).slice(0, 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('[tokens] Decryption failed:', err.message);
    throw new Error('Failed to decrypt token');
  }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

// GET /api/tokens - Get all stored tokens for user
router.get('/', authMw, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT provider, account_email, access_token, refresh_token, expires_at, scope, updated_at
       FROM oauth_tokens
       WHERE user_id = $1`,
      [userId]
    );

    // Decrypt tokens before sending
    const tokens = result.rows.map(row => ({
      provider: row.provider,
      accountEmail: row.account_email,
      accessToken: row.access_token ? decrypt(row.access_token) : null,
      refreshToken: row.refresh_token ? decrypt(row.refresh_token) : null,
      expiresAt: row.expires_at ? row.expires_at.getTime() : null,
      scope: row.scope,
      updatedAt: row.updated_at,
    }));

    res.json({ tokens });
  } catch (err) {
    console.error('[tokens] GET error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve tokens' });
  }
});

// POST /api/tokens - Save encrypted token
router.post('/', authMw, async (req, res) => {
  try {
    const userId = req.user.id;
    const { provider, accessToken, refreshToken, expiresAt, scope, accountEmail, accountId } = req.body;

    if (!provider || !accessToken) {
      return res.status(400).json({ error: 'Provider and accessToken required' });
    }

    // Encrypt tokens
    const encryptedAccess = encrypt(accessToken);
    const encryptedRefresh = refreshToken ? encrypt(refreshToken) : null;

    // Upsert token
    await pool.query(
      `INSERT INTO oauth_tokens (user_id, provider, provider_account_id, access_token, refresh_token, expires_at, scope, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (user_id, provider)
       DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at = EXCLUDED.expires_at,
         scope = EXCLUDED.scope,
         updated_at = NOW()`,
      [userId, provider, accountId, encryptedAccess, encryptedRefresh, expiresAt ? new Date(expiresAt) : null, scope]
    );

    res.json({ success: true, provider });
  } catch (err) {
    console.error('[tokens] POST error:', err.message);
    res.status(500).json({ error: 'Failed to save token' });
  }
});

// PATCH /api/tokens/:provider - Update specific token
router.patch('/:provider', authMw, async (req, res) => {
  try {
    const userId = req.user.id;
    const { provider } = req.params;
    const { accessToken, refreshToken, expiresAt } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (accessToken) {
      updates.push(`access_token = $${paramCount++}`);
      values.push(encrypt(accessToken));
    }

    if (refreshToken) {
      updates.push(`refresh_token = $${paramCount++}`);
      values.push(encrypt(refreshToken));
    }

    if (expiresAt) {
      updates.push(`expires_at = $${paramCount++}`);
      values.push(new Date(expiresAt));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId, provider);

    const result = await pool.query(
      `UPDATE oauth_tokens
       SET ${updates.join(', ')}
       WHERE user_id = $${paramCount++} AND provider = $${paramCount}
       RETURNING provider`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    res.json({ success: true, provider });
  } catch (err) {
    console.error('[tokens] PATCH error:', err.message);
    res.status(500).json({ error: 'Failed to update token' });
  }
});

// DELETE /api/tokens/:provider - Remove token
router.delete('/:provider', authMw, async (req, res) => {
  try {
    const userId = req.user.id;
    const { provider } = req.params;

    const result = await pool.query(
      `DELETE FROM oauth_tokens
       WHERE user_id = $1 AND provider = $2
       RETURNING provider`,
      [userId, provider]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    res.json({ success: true, provider });
  } catch (err) {
    console.error('[tokens] DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to delete token' });
  }
});

// GET /api/tokens/preference - Get user's token storage preference
router.get('/preference', authMw, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user has a preference stored
    // For now, default to server storage
    const result = await pool.query(
      `SELECT setting_value FROM user_settings
       WHERE user_id = $1 AND setting_key = 'token_storage_preference'`,
      [userId]
    );

    const preference = result.rows[0]?.setting_value || 'server';

    res.json({ preference });
  } catch (err) {
    console.error('[tokens] preference GET error:', err.message);
    res.status(500).json({ error: 'Failed to get preference' });
  }
});

// PATCH /api/tokens/preference - Update user's token storage preference
router.patch('/preference', authMw, async (req, res) => {
  try {
    const userId = req.user.id;
    const { preference } = req.body; // 'server' or 'browser_only'

    if (!['server', 'browser_only'].includes(preference)) {
      return res.status(400).json({ error: 'Invalid preference. Must be "server" or "browser_only"' });
    }

    // Store preference - create settings table if needed
    // For now, we'll assume the table exists
    await pool.query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at)
       VALUES ($1, 'token_storage_preference', $2, NOW(), NOW())
       ON CONFLICT (user_id, setting_key)
       DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
      [userId, preference]
    );

    // If switching to browser_only, delete all stored tokens
    if (preference === 'browser_only') {
      await pool.query(
        `DELETE FROM oauth_tokens WHERE user_id = $1`,
        [userId]
      );
    }

    res.json({ success: true, preference });
  } catch (err) {
    console.error('[tokens] preference PATCH error:', err.message);
    res.status(500).json({ error: 'Failed to update preference' });
  }
});

module.exports = router;
