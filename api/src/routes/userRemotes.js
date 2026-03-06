const express = require('express');
const path = require('path');
const pool = require('../db/client');
const authMw = require('../middleware/auth');
const encryption = require('../services/encryption');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
router.use(authMw);

const qaMockStates = new Map();

function isQaSeededToken(accessToken) {
  return accessToken === 'google-access-a' ||
    accessToken === 'google-access-b' ||
    accessToken === 'dropbox-access-a' ||
    accessToken === 'mock-qa-token';
}

function qaMockAccount(accessToken) {
  return accessToken.includes('-a') || accessToken.includes('mock') ? 'A' : 'B';
}

function qaMockId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createQaMockItem(provider, account, overrides = {}) {
  const isFolder = Boolean(overrides.isFolder);
  const name = overrides.name || (isFolder
    ? `Folder from ${provider.toUpperCase()} ${account}`
    : `File from ${provider.toUpperCase()} ${account}.txt`);
  const itemId = overrides.id || `${isFolder ? 'dir' : 'file'}-${provider}-${account.toLowerCase()}`;
  const modifiedTime = overrides.modifiedTime || new Date().toISOString();
  const parentId = overrides.parentId !== undefined ? overrides.parentId : qaMockRootFolderId(provider);
  const normalizedPath = overrides.pathDisplay || (provider === 'dropbox'
    ? `${parentId || ''}/${name}`.replace(/\/{2,}/g, '/')
    : `/${name}`);

  return {
    id: itemId,
    name,
    mimeType: overrides.mimeType || (isFolder ? qaMockFolderMimeType(provider) : 'text/plain'),
    size: Number(overrides.size || (isFolder ? 0 : 100)),
    modifiedTime,
    createdTime: overrides.createdTime || modifiedTime,
    isFolder,
    parentId,
    pathDisplay: normalizedPath,
    pathLower: normalizedPath.toLowerCase(),
    content: overrides.content || `CacheFlow QA mock file\nProvider: ${provider}\nAccount: ${account}\nFile: ${name}\n`,
  };
}

function qaMockRootFolderId(provider) {
  if (provider === 'dropbox') return '';
  if (provider === 'box' || provider === 'pcloud') return '0';
  return 'root';
}

function qaMockFolderMimeType(provider) {
  return provider === 'google' ? 'application/vnd.google-apps.folder' : 'folder';
}

function getQaMockState(remoteId, provider, account) {
  if (!qaMockStates.has(remoteId)) {
    qaMockStates.set(remoteId, {
      items: [
        createQaMockItem(provider, account),
        createQaMockItem(provider, account, { isFolder: true }),
      ],
    });
  }

  return qaMockStates.get(remoteId);
}

function qaMockSerializeItem(item) {
  return {
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    size: item.size,
    createdTime: item.createdTime,
    modifiedTime: item.modifiedTime,
    parents: item.parentId ? [item.parentId] : [],
    path: item.pathDisplay,
    pathDisplay: item.pathDisplay,
    path_display: item.pathDisplay,
    path_lower: item.pathLower,
    isFolder: item.isFolder,
    uuid: item.id,
    type: item.isFolder ? 'folder' : 'file',
    updatedAt: item.modifiedTime,
    createdAt: item.createdTime,
    '.tag': item.isFolder ? 'folder' : 'file',
    client_modified: item.modifiedTime,
    server_modified: item.modifiedTime,
  };
}

function qaMockListPayload(items) {
  return {
    success: true,
    data: items.map((item) => ({
      uuid: item.id,
      name: item.name,
      type: item.isFolder ? 'folder' : 'file',
      size: item.size,
      createdAt: item.createdTime,
      updatedAt: item.modifiedTime,
    })),
    files: items.map((item) => ({
      id: item.id,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
      modifiedTime: item.modifiedTime,
      isFolder: item.isFolder,
      path: item.pathDisplay,
      pathDisplay: item.pathDisplay,
    })),
    entries: items.map((item) => ({
      '.tag': item.isFolder ? 'folder' : 'file',
      name: item.name,
      id: item.id,
      size: item.size,
      client_modified: item.modifiedTime,
      path_display: item.pathDisplay,
      path_lower: item.pathLower,
    })),
    matches: items
      .filter((item) => !item.isFolder)
      .map((item) => ({
        metadata: {
          metadata: {
            '.tag': 'file',
            name: item.name,
            id: item.id,
            size: item.size,
            client_modified: item.modifiedTime,
            path_display: item.pathDisplay,
          },
        },
      })),
    nextPageToken: null,
  };
}

function qaMockExtractTarget(url, headers = {}, body = {}) {
  const urlString = String(url || '');
  const bodyPath = body?.path || body?.from_path || body?.fileId || body?.id;
  const dropboxArg = headers?.['Dropbox-API-Arg'] || headers?.['dropbox-api-arg'];

  if (bodyPath) return String(bodyPath);

  if (dropboxArg) {
    try {
      const parsed = JSON.parse(dropboxArg);
      if (parsed.path) return String(parsed.path);
    } catch {}
  }

  const driveMatch = urlString.match(/\/files\/([^/?]+)(?:\?|$)/);
  if (driveMatch) return decodeURIComponent(driveMatch[1]);

  return '';
}

function qaMockFindItem(state, identifier) {
  if (!identifier) return null;
  const value = String(identifier);
  return state.items.find((item) =>
    item.id === value ||
    item.pathDisplay === value ||
    item.pathLower === value.toLowerCase() ||
    `/${item.name}` === value
  ) || null;
}

function qaMockResolveUploadName(provider, headers = {}, body = {}, account = 'A') {
  const explicit = headers['X-CacheFlow-File-Name'] || headers['x-cacheflow-file-name'];
  if (explicit) return String(explicit);

  const dropboxArg = headers['Dropbox-API-Arg'] || headers['dropbox-api-arg'];
  if (dropboxArg) {
    try {
      const parsed = JSON.parse(dropboxArg);
      if (parsed.path) return path.posix.basename(parsed.path);
    } catch {}
  }

  if (body?.name) return String(body.name);
  return `Uploaded to ${provider.toUpperCase()} ${account}.txt`;
}

function qaMockFilterItemsForRequest(state, url, body = {}) {
  const query = String(body?.query || '').trim().toLowerCase();
  if (query) {
    return state.items.filter((item) => item.name.toLowerCase().includes(query));
  }

  const urlString = String(url || '');
  const parentFromBody = body?.path ?? body?.folderId;
  const parentFromQuery = (() => {
    const match = urlString.match(/q='([^']+)'%20in%20parents/i);
    return match ? decodeURIComponent(match[1]) : null;
  })();
  const parentId = parentFromBody !== undefined && parentFromBody !== null ? String(parentFromBody) : parentFromQuery;

  if (parentId === null || parentId === undefined) {
    return state.items;
  }

  return state.items.filter((item) => String(item.parentId || '') === parentId);
}

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

    // QA Mocking for health
    if (process.env.QA_SEED_ENABLED === 'true') {
      if (remote.display_name === 'Dropbox A' && process.env.QA_SIMULATE_DEGRADED === 'true') {
        return res.ok({ status: 'degraded', message: 'Simulated degradation for Dropbox' });
      }
      if (remote.display_name === 'QA Mock Drive' && process.env.QA_SIMULATE_REAUTH === 'true') {
        return res.ok({ status: 'needs_reauth', message: 'Simulated re-auth required' });
      }
      return res.ok({ status: 'connected' });
    }

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
  const parsedBody = typeof body === 'string'
    ? (() => {
        try {
          return JSON.parse(body);
        } catch {
          return body;
        }
      })()
    : body;

  if (!url) return res.fail('URL is required', 400);

  try {
    const result = await pool.query(
      `SELECT access_token_enc, provider FROM user_remotes WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) return res.fail('Remote not found', 404);

    const remote = result.rows[0];
    const accessToken = encryption.decrypt(remote.access_token_enc);

    // QA Mocking: If it's a seeded remote and dummy token, return mock data
    if (process.env.QA_SEED_ENABLED === 'true' && isQaSeededToken(accessToken)) {
      const account = qaMockAccount(accessToken);
      const state = getQaMockState(id, remote.provider, account);
      const methodUpper = String(method || 'GET').toUpperCase();
      const target = qaMockExtractTarget(url, headers, parsedBody);
      const targetItem = qaMockFindItem(state, target);

      console.log(`[QA-MOCK] Intercepting ${remote.provider} request for account ${account}: ${methodUpper} ${url}`);

      if (
        String(url).includes('alt=media') ||
        String(url).includes('/files/download') ||
        String(url).includes('/export?mimeType=') ||
        /\/content(?:\?|$)/.test(String(url))
      ) {
        const item = targetItem || state.items.find((entry) => !entry.isFolder) || null;
        res.setHeader('Content-Type', item?.mimeType || 'text/plain; charset=utf-8');
        return res.status(200).send(item?.content || 'CacheFlow QA mock content');
      }

      if (String(url).includes('?fields=parents')) {
        return res.status(200).json({
          parents: targetItem?.parentId ? [targetItem.parentId] : [],
        });
      }

      if (methodUpper === 'DELETE' || String(url).includes('delete')) {
        if (targetItem) {
          state.items = state.items.filter((item) => item.id !== targetItem.id);
        }
        return res.status(200).json({ success: true, ok: true, deleted: true, metadata: targetItem ? qaMockSerializeItem(targetItem) : null });
      }

      if (String(url).includes('upload')) {
        const fileName = qaMockResolveUploadName(remote.provider, headers, parsedBody, account);
        const newItem = createQaMockItem(remote.provider, account, {
          id: qaMockId(`file-${remote.provider}-${account.toLowerCase()}`),
          name: fileName,
          parentId: qaMockRootFolderId(remote.provider),
          modifiedTime: new Date().toISOString(),
        });

        state.items = [newItem, ...state.items];

        return res.status(200).json({
          ok: true,
          success: true,
          ...qaMockSerializeItem(newItem),
        });
      }

      if (String(url).includes('/copy') || String(url).includes('copy_v2')) {
        const source = targetItem || qaMockFindItem(state, parsedBody?.from_path);
        if (!source) {
          return res.status(404).json({ success: false, error: 'Mock source file not found' });
        }

        const copied = createQaMockItem(remote.provider, account, {
          id: qaMockId(`file-${remote.provider}-${account.toLowerCase()}`),
          name: path.posix.basename(parsedBody?.to_path || source.name),
          mimeType: source.mimeType,
          size: source.size,
          parentId: source.parentId,
          content: source.content,
        });

        state.items = [copied, ...state.items];

        return res.status(200).json({
          success: true,
          ok: true,
          id: copied.id,
          metadata: qaMockSerializeItem(copied),
        });
      }

      if (methodUpper === 'PATCH' || String(url).includes('move_v2')) {
        const source = targetItem || qaMockFindItem(state, parsedBody?.from_path);
        if (!source) {
          return res.status(404).json({ success: false, error: 'Mock source file not found' });
        }

        if (parsedBody?.name) {
          source.name = String(parsedBody.name);
        }
        if (parsedBody?.to_path) {
          source.name = path.posix.basename(parsedBody.to_path);
          source.pathDisplay = parsedBody.to_path;
          source.pathLower = String(parsedBody.to_path).toLowerCase();
        }
        if (parsedBody?.addParents) {
          source.parentId = parsedBody.addParents;
        }
        source.modifiedTime = new Date().toISOString();

        return res.status(200).json({
          success: true,
          ok: true,
          id: source.id,
          ...qaMockSerializeItem(source),
          metadata: qaMockSerializeItem(source),
        });
      }

      if (String(url).includes('get_metadata') || /\/files\/[^/?]+(?:\?|$)/.test(String(url))) {
        if (targetItem) {
          return res.status(200).json(qaMockSerializeItem(targetItem));
        }
      }

      if (String(url).includes('files') || String(url).includes('list') || String(url).includes('dir/list') || String(url).includes('search')) {
        return res.status(200).json(qaMockListPayload(qaMockFilterItemsForRequest(state, url, parsedBody)));
      }

      return res.status(200).json({
        success: true,
        data: { used: 1000000, total: 1000000000 },
        storageQuota: { limit: '15000000000', usage: '1000000000', usageInDrive: '500000000' },
        user: { displayName: `Mock User ${account}`, emailAddress: `${remote.provider}${account.toLowerCase()}@example.com` },
      });
    }

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
