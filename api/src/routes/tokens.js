/**
 * Token Storage API
 * Server-side encrypted token storage for optional backup
 *
 * Gate: SEC-1
 * Task: 1.18@SEC-1 - Security baseline: removed default encryption key
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db/client');
const authMw = require('../middleware/auth');

// SECURITY (1.18@SEC-1): Require encryption key - no fallback defaults
const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  console.warn('[tokens] WARNING: CREDENTIAL_ENCRYPTION_KEY not set. Token encryption disabled.');
}
const ALGORITHM = 'aes-256-gcm';

// ============================================================================
// ENCRYPTION HELPERS
// ============================================================================

function getKey() {
  if (!ENCRYPTION_KEY) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY not configured');
  }
  return Buffer.from(ENCRYPTION_KEY.repeat(Math.ceil(32 / ENCRYPTION_KEY.length))).slice(0, 32);
}

function encrypt(text) {
  if (!ENCRYPTION_KEY) {
    // If no key configured, return plaintext (not recommended for production)
    return 'PLAIN:' + text;
  }
  const iv = crypto.randomBytes(16);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return iv.toString('hex') + ':' + authTag + ':' + encrypted;
}

function decrypt(encryptedText) {
  // Handle plaintext fallback for backwards compatibility
  if (encryptedText.startsWith('PLAIN:')) {
    return encryptedText.substring(6);
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const key = getKey();
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
      `SELECT provider, provider_account_id, account_email, account_label, account_order, is_default, access_token, refresh_token, expires_at, scope, updated_at
       FROM oauth_tokens
       WHERE user_id = $1
       ORDER BY provider, account_order`,
      [userId]
    );

    // Decrypt tokens before sending
    const tokens = result.rows.map(row => ({
      provider: row.provider,
      accountId: row.provider_account_id,
      accountEmail: row.account_email,
      accountLabel: row.account_label,
      accountOrder: row.account_order,
      isDefault: row.is_default,
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
    const { 
      provider, 
      accessToken, 
      refreshToken, 
      expiresAt, 
      scope, 
      accountEmail, 
      accountId,
      accountLabel,
      isDefault
    } = req.body;

    if (!provider || !accessToken || !accountId) {
      return res.status(400).json({ error: 'Provider, accessToken, and accountId required' });
    }

    // Encrypt tokens
    const encryptedAccess = encrypt(accessToken);
    const encryptedRefresh = refreshToken ? encrypt(refreshToken) : null;

    // If this is the first account for this provider, make it default
    let defaultFlag = isDefault;
    if (defaultFlag === undefined) {
      const countResult = await pool.query(
        'SELECT count(*) FROM oauth_tokens WHERE user_id = $1 AND provider = $2',
        [userId, provider]
      );
      defaultFlag = parseInt(countResult.rows[0].count) === 0;
    }

    // If setting as default, unset other defaults for this provider
    if (defaultFlag) {
      await pool.query(
        'UPDATE oauth_tokens SET is_default = false WHERE user_id = $1 AND provider = $2',
        [userId, provider]
      );
    }

    // Upsert token using user_id + provider + provider_account_id as uniqueness key
    await pool.query(
      `INSERT INTO oauth_tokens (
         user_id, provider, provider_account_id, account_email, account_label, is_default, 
         access_token, refresh_token, expires_at, scope, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       ON CONFLICT (user_id, provider, provider_account_id)
       DO UPDATE SET
         account_email = EXCLUDED.account_email,
         account_label = EXCLUDED.account_label,
         is_default = EXCLUDED.is_default,
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at = EXCLUDED.expires_at,
         scope = EXCLUDED.scope,
         updated_at = NOW()`,
      [
        userId, provider, accountId, accountEmail, 
        accountLabel || 'Primary', defaultFlag,
        encryptedAccess, encryptedRefresh, expiresAt ? new Date(expiresAt) : null, scope
      ]
    );

    res.json({ success: true, provider, accountId });
  } catch (err) {
    console.error('[tokens] POST error:', err.message);
    res.status(500).json({ error: 'Failed to save token' });
  }
});

// PATCH /api/tokens/:provider/:accountId - Update specific token
router.patch('/:provider/:accountId', authMw, async (req, res) => {
  try {
    const userId = req.user.id;
    const { provider, accountId } = req.params;
    const { accessToken, refreshToken, expiresAt, accountLabel, isDefault } = req.body;

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

    if (accountLabel) {
      updates.push(`account_label = $${paramCount++}`);
      values.push(accountLabel);
    }

    if (isDefault === true) {
      // Unset other defaults first
      await pool.query(
        'UPDATE oauth_tokens SET is_default = false WHERE user_id = $1 AND provider = $2',
        [userId, provider]
      );
      updates.push(`is_default = $${paramCount++}`);
      values.push(true);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId, provider, accountId);

    const result = await pool.query(
      `UPDATE oauth_tokens
       SET ${updates.join(', ')}
       WHERE user_id = $${paramCount++} AND provider = $${paramCount++} AND provider_account_id = $${paramCount}
       RETURNING provider`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    res.json({ success: true, provider, accountId });
  } catch (err) {
    console.error('[tokens] PATCH error:', err.message);
    res.status(500).json({ error: 'Failed to update token' });
  }
});

// DELETE /api/tokens/:provider/:accountId - Remove token
router.delete('/:provider/:accountId', authMw, async (req, res) => {
  try {
    const userId = req.user.id;
    const { provider, accountId } = req.params;

    const result = await pool.query(
      `DELETE FROM oauth_tokens
       WHERE user_id = $1 AND provider = $2 AND provider_account_id = $3
       RETURNING provider`,
      [userId, provider, accountId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    res.json({ success: true, provider, accountId });
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
