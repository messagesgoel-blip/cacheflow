const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const pool = require('../db/client');
const authMw = require('../middleware/auth');

const router = express.Router();
const OAuth2 = google.auth.OAuth2;

// Google OAuth configuration
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://cacheflow-api.goels.in/remotes/google/callback';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const REMOTES_CONFIG_FILE = process.env.REMOTES_CONFIG_FILE || '/app/data/remotes.json';

// Simple encryption helpers for tokens
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || 'cacheflow-tokens-key';

function encryptToken(token) {
  const data = Buffer.from(token);
  const key = Buffer.from(ENCRYPTION_KEY.repeat(Math.ceil(data.length / ENCRYPTION_KEY.length)));
  const encrypted = data.map((byte, i) => byte ^ key[i % key.length]);
  return Buffer.from(encrypted).toString('base64');
}

function decryptToken(encrypted) {
  const data = Buffer.from(encrypted, 'base64');
  const key = Buffer.from(ENCRYPTION_KEY.repeat(Math.ceil(data.length / ENCRYPTION_KEY.length)));
  const decrypted = data.map((byte, i) => byte ^ key[i % key.length]);
  return Buffer.from(decrypted).toString('utf8');
}

// Ensure remotes config file exists
function getRemotes() {
  try {
    if (fs.existsSync(REMOTES_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(REMOTES_CONFIG_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[remotes] Error reading config:', err.message);
  }
  return [];
}

function saveRemotes(remotes) {
  fs.writeFileSync(REMOTES_CONFIG_FILE, JSON.stringify(remotes, null, 2));
}

// POST /remotes/google/callback - Handle OAuth callback from Google
router.post('/google/callback', async (req, res) => {
  try {
    const { code, state, remote_name } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'No authorization code provided' });
    }

    // Verify the JWT from state to get user ID
    let userId = null;
    try {
      const decoded = jwt.verify(state, JWT_SECRET);
      userId = decoded.id;
    } catch (e) {
      console.error('[oauth] Invalid state token:', e.message);
    }

    // Get client credentials from environment
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[oauth] Missing Google OAuth credentials');
      return res.status(500).json({ error: 'Server not configured for Google OAuth' });
    }

    // Exchange code for tokens using googleapis
    const oauth2Client = new OAuth2(clientId, clientSecret, GOOGLE_REDIRECT_URI);

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return res.status(400).json({ error: 'Failed to get access token' });
    }

    // Determine remote name
    const name = remote_name || 'gdrive';

    // Get user info from Google
    let userEmail = null;
    try {
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      userEmail = userInfo.data.email;
    } catch (e) {
      console.error('[oauth] Could not get user info:', e.message);
    }

    // Encrypt tokens before storing
    const encryptedAccess = encryptToken(tokens.access_token);
    const encryptedRefresh = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;

    // Store tokens in database
    if (userId) {
      try {
        await pool.query(`
          INSERT INTO oauth_tokens (user_id, provider, provider_account_id, access_token, refresh_token, expires_at, scope)
          VALUES ($1, 'google_drive', $2, $3, $4, $5, $6)
          ON CONFLICT (user_id, provider)
          DO UPDATE SET
            access_token = $3,
            refresh_token = COALESCE($4, oauth_tokens.refresh_token),
            expires_at = $5,
            scope = $6,
            updated_at = NOW()
        `, [userId, userEmail, encryptedAccess, encryptedRefresh, tokens.expiry_date || null, tokens.scope]);
      } catch (e) {
        console.error('[oauth] Could not store tokens in DB:', e.message);
      }
    }

    // Create rclone config with tokens
    try {
      const tokenJson = JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type || 'Bearer',
        expiry_date: tokens.expiry_date
      });

      await execRclone(
        `config create "${name}" "drive" client_id="${clientId}" client_secret="${clientSecret}" config_is_local=false config_token="${tokenJson}" --non-interactive`
      );
    } catch (e) {
      console.error('[oauth] Could not create rclone config:', e.message);
    }

    // Update remote status in config
    const remotes = getRemotes();
    const remote = remotes.find(r => r.name === name);
    if (remote) {
      remote.status = 'connected';
      remote.connectedAt = new Date().toISOString();
      saveRemotes(remotes);
    }

    res.json({ success: true, message: 'Google Drive connected successfully' });
  } catch (err) {
    console.error('[oauth] callback error:', err);
    res.status(500).json({ error: err.message || 'OAuth callback failed' });
  }
});

// GET /remotes - List all configured cloud remotes
router.get('/', async (req, res) => {
  try {
    const remotes = getRemotes();

    // Add usage info for each remote using rclone
    const remotesWithInfo = await Promise.all(remotes.map(async (remote) => {
      try {
        const info = await getRemoteInfo(remote.name);
        return { ...remote, ...info };
      } catch (err) {
        return { ...remote, status: 'error', error: err.message };
      }
    }));

    res.json({ remotes: remotesWithInfo });
  } catch (err) {
    console.error('[remotes] list:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /remotes/:name/browse - Browse a remote's contents
router.get('/:name/browse', async (req, res) => {
  try {
    const { name } = req.params;
    const remotePath = req.query.path || '/';

    const remotes = getRemotes();
    const remote = remotes.find(r => r.name === name);

    if (!remote) {
      return res.status(404).json({ error: 'Remote not found' });
    }

    let entries = [];

    // For Google Drive, use the Google Drive API directly
    if (remote.type === 'drive' && remote.tokens) {
      try {
        const drive = await getDriveClient(remote);

        // Get folder ID from path
        let folderId = 'root';
        if (remotePath && remotePath !== '/') {
          // Build the path query - need to traverse the path
          const pathParts = remotePath.split('/').filter(Boolean);
          let currentId = 'root';
          for (const part of pathParts) {
            const result = await drive.files.list({
              q: `'${currentId}' in parents and name = '${part}' and trashed = false`,
              fields: 'files(id, name)',
              spaces: 'drive',
              pageSize: 1
            });
            if (result.data.files && result.data.files.length > 0) {
              currentId = result.data.files[0].id;
            } else {
              return res.status(404).json({ error: 'Path not found' });
            }
          }
          folderId = currentId;
        }

        // List files in the folder
        const result = await drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType, size, modifiedTime)',
          spaces: 'drive',
          orderBy: 'name'
        });

        entries = (result.data.files || []).map(file => ({
          Name: file.name,
          Path: remotePath === '/' ? file.name : `${remotePath}/${file.name}`,
          IsDir: file.mimeType === 'application/vnd.google-apps.folder',
          Size: parseInt(file.size || 0),
          ModTime: file.modifiedTime
        }));
      } catch (err) {
        console.error('[remotes] Drive API browse error:', err.message);
        return res.status(500).json({ error: 'Failed to browse Google Drive: ' + err.message });
      }
    } else {
      // Use rclone to list the remote
      const output = await execRclone(`lsjson "${name}:${remotePath}"`);
      entries = JSON.parse(output);
    }

    const folders = [];
    const files = [];

    for (const entry of entries) {
      if (entry.IsDir) {
        folders.push({
          name: entry.Name,
          path: entry.Path,
          isFolder: true
        });
      } else {
        files.push({
          name: entry.Name,
          path: entry.Path,
          isFolder: false,
          size_bytes: entry.Size,
          last_modified: entry.ModTime
        });
      }
    }

    // Sort alphabetically
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      path: remotePath,
      folders,
      files,
      totalItems: folders.length + files.length,
      remoteName: name,
      remoteType: remote.type
    });
  } catch (err) {
    console.error('[remotes] browse:', err.message);
    res.status(500).json({ error: err.message || 'failed to browse remote' });
  }
});

// POST /remotes - Add a new remote
router.post('/', async (req, res) => {
  try {
    const { name, type, provider, config } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'name and type required' });
    }

    const remotes = getRemotes();

    // Check for duplicate name
    if (remotes.some(r => r.name === name)) {
      return res.status(409).json({ error: 'remote with this name already exists' });
    }

    // For Google Drive with OAuth flow, just create entry and mark as pending_oauth
    if (type === 'drive' && !config?.client_id) {
      // Use built-in OAuth - mark as pending_oauth
      const remote = {
        id: Date.now().toString(),
        name,
        type: 'drive',
        provider: provider || 'Google Drive',
        config: {},
        status: 'pending_oauth',
        createdAt: new Date().toISOString()
      };

      remotes.push(remote);
      saveRemotes(remotes);

      return res.json({ success: true, remote: { id: remote.id, name, type: 'drive', provider: 'Google Drive' }, needsOAuth: true });
    }

    // For other types or with credentials, use rclone
    if (config) {
      const configStr = Object.entries(config)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      await execRclone(`config create "${name}" "${type}" ${configStr}`);
    }

    // Add to our config
    const remote = {
      id: Date.now().toString(),
      name,
      type,
      provider: provider || type,
      config: config || {},
      status: 'connected',
      createdAt: new Date().toISOString()
    };

    remotes.push(remote);
    saveRemotes(remotes);

    res.json({ success: true, remote: { id: remote.id, name, type, provider } });
  } catch (err) {
    console.error('[remotes] add:', err.message);
    res.status(500).json({ error: err.message || 'failed to add remote' });
  }
});

// POST /remotes/:name/token - Complete OAuth flow
router.post('/:name/token', async (req, res) => {
  try {
    const { name } = req.params;
    const { token, credentials } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'token required' });
    }

    const remotes = getRemotes();
    const remote = remotes.find(r => r.name === name);

    if (!remote) {
      return res.status(404).json({ error: 'remote not found' });
    }

    // Get credentials from environment or stored config
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || GOOGLE_CLIENT_SECRET;

    let creds = { client_id: clientId, client_secret: clientSecret };
    if (credentials) {
      try {
        creds = typeof credentials === 'string' ? JSON.parse(Buffer.from(credentials, 'base64').toString()) : credentials;
      } catch (e) {
        console.error('[oauth] Could not parse credentials:', e.message);
      }
    }

    // Create config with token using non-interactive mode
    const tokenJson = JSON.stringify(JSON.parse(token));
    await execRclone(
      `config create "${name}" "drive" client_id="${creds.client_id}" client_secret="${creds.client_secret}" config_is_local=false config_token="${tokenJson}" --json`
    );

    // Update remote status
    remote.status = 'connected';
    saveRemotes(remotes);

    res.json({ success: true, status: 'connected' });
  } catch (err) {
    console.error('[remotes] token:', err.message);
    res.status(500).json({ error: err.message || 'failed to save token' });
  }
});

// DELETE /remotes/:name - Remove a remote
router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params;

    let remotes = getRemotes();
    const remote = remotes.find(r => r.name === name);

    if (!remote) {
      return res.status(404).json({ error: 'remote not found' });
    }

    // Delete from rclone config
    try {
      await execRclone(`config delete "${name}"`);
    } catch (e) {
      console.error('[remotes] Could not delete rclone config:', e.message);
    }

    // Remove from our config
    remotes = remotes.filter(r => r.name !== name);
    saveRemotes(remotes);

    res.json({ success: true });
  } catch (err) {
    console.error('[remotes] delete:', err.message);
    res.status(500).json({ error: err.message || 'failed to delete remote' });
  }
});

// POST /remotes/:name/copy - Copy file from remote to local
router.post('/:name/copy', async (req, res) => {
  try {
    const { name } = req.params;
    const { remotePath, localPath } = req.body;

    if (!remotePath) {
      return res.status(400).json({ error: 'remotePath required' });
    }

    const remotes = getRemotes();
    const remote = remotes.find(r => r.name === name);

    if (!remote) {
      return res.status(404).json({ error: 'remote not found' });
    }

    const destPath = localPath || `${req.user.id}/${path.basename(remotePath)}`;

    // Copy from remote to local
    await execRclone(`copy "${name}:${remotePath}" "/mnt/local/${destPath}" --progress`);

    res.json({ success: true, message: `Copied ${remotePath} to local storage` });
  } catch (err) {
    console.error('[remotes] copy:', err.message);
    res.status(500).json({ error: err.message || 'failed to copy file' });
  }
});

// Helper: Execute rclone command
function execRclone(cmd) {
  return new Promise((resolve, reject) => {
    const fullCmd = `/usr/local/bin/rclone ${cmd}`;
    exec(fullCmd, {
      timeout: 30000,
      env: { ...process.env, RCLONE_CONFIG: '/app/data/rclone.conf' }
    }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

// POST /remotes/google/start - Initiate Google OAuth flow
router.post('/google/start', async (req, res) => {
  try {
    const { name, credentials } = req.body;

    if (!name || !credentials || !credentials.client_id || !credentials.client_secret) {
      return res.status(400).json({ error: 'name and credentials (client_id, client_secret) required' });
    }

    const clientId = credentials.client_id;
    const clientSecret = credentials.client_secret;

    // Create OAuth2 client
    const oauth2Client = new OAuth2(
      clientId,
      clientSecret,
      GOOGLE_REDIRECT_URI
    );

    // Generate state for CSRF protection (store remote name temporarily)
    const crypto = require('crypto');
    const state = crypto.randomBytes(32).toString('hex');

    // Store state with remote name for callback
    storeOAuthState(state, { name, clientId, clientSecret });

    // Generate OAuth URL
    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent'
    });

    res.json({ authUrl, state });
  } catch (err) {
    console.error('[remotes] google start:', err.message);
    res.status(500).json({ error: err.message || 'failed to start OAuth' });
  }
});

// GET /remotes/google/callback - Handle OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      console.error('[remotes] OAuth error:', oauthError);
      return res.redirect(`${process.env.WEB_URL || 'https://cacheflow.goels.in'}/remotes?error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.WEB_URL || 'https://cacheflow.goels.in'}/remotes?error=missing_params`);
    }

    // Get stored state data
    const stateData = getOAuthState(state);
    if (!stateData) {
      return res.redirect(`${process.env.WEB_URL || 'https://cacheflow.goels.in'}/remotes?error=invalid_state`);
    }

    const { name, clientId, clientSecret } = stateData;

    // Create OAuth2 client and exchange code for tokens
    const oauth2Client = new OAuth2(
      clientId,
      clientSecret,
      GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    // Store tokens in database for the user (we need user_id from the state - but JWT is in the frontend state)
    // For now, store in the remote config (encrypted)
    const remotes = getRemotes();
    const remote = remotes.find(r => r.name === name);

    if (!remote) {
      return res.redirect(`${process.env.WEB_URL || 'https://cacheflow.goels.in'}/remotes?error=remote_not_found`);
    }

    // Store tokens in remote config (encrypted)
    remote.tokens = {
      access_token: encryptToken(tokens.access_token),
      refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expires_at: tokens.expiry_date,
      scope: tokens.scope
    };
    remote.status = 'connected';

    saveRemotes(remotes);

    // Clear state
    clearOAuthState(state);

    console.log(`[remotes] Google OAuth successful for remote: ${name}`);

    // Redirect to success page
    res.redirect(`${process.env.WEB_URL || 'https://cacheflow.goels.in'}/remotes?success=connected`);
  } catch (err) {
    console.error('[remotes] google callback:', err.message);
    res.redirect(`${process.env.WEB_URL || 'https://cacheflow.goels.in'}/remotes?error=${encodeURIComponent(err.message)}`);
  }
});

// POST /remotes/google/connect - Connect Google Drive with user credentials (simpler flow)
router.post('/google/connect', async (req, res) => {
  try {
    const { name, credentials, authCode } = req.body;

    if (!name || !credentials || !credentials.client_id || !credentials.client_secret) {
      return res.status(400).json({ error: 'name and credentials (client_id, client_secret) required' });
    }

    if (!authCode) {
      // Return the OAuth URL to redirect user to
      const { client_id, client_secret } = credentials;

      const oauth2Client = new OAuth2(
        client_id,
        client_secret,
        GOOGLE_REDIRECT_URI
      );

      const crypto = require('crypto');
      const state = crypto.randomBytes(32).toString('hex');

      storeOAuthState(state, { name, clientId: client_id, clientSecret: client_secret });

      const scopes = [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
      ];

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state: state,
        prompt: 'consent'
      });

      return res.json({ authUrl, state, needsAuth: true });
    }

    // Exchange auth code for tokens
    const { client_id, client_secret } = credentials;

    const oauth2Client = new OAuth2(
      client_id,
      client_secret,
      GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(authCode);

    // Store remote
    const remotes = getRemotes();

    // Check for duplicate
    if (remotes.some(r => r.name === name)) {
      return res.status(409).json({ error: 'remote with this name already exists' });
    }

    const remote = {
      id: Date.now().toString(),
      name,
      type: 'drive',
      provider: 'google_drive',
      config: { client_id, client_secret },
      tokens: {
        access_token: encryptToken(tokens.access_token),
        refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        expires_at: tokens.expiry_date,
        scope: tokens.scope
      },
      status: 'connected',
      createdAt: new Date().toISOString()
    };

    remotes.push(remote);
    saveRemotes(remotes);

    res.json({ success: true, remote: { id: remote.id, name, type: 'drive', provider: 'google_drive' } });
  } catch (err) {
    console.error('[remotes] google connect:', err.message);
    res.status(500).json({ error: err.message || 'failed to connect Google Drive' });
  }
});

// Helper: Get Google Drive client for a remote
async function getDriveClient(remote) {
  if (!remote.tokens) {
    throw new Error('No tokens stored for this remote');
  }

  const { client_id, client_secret } = remote.config;

  const oauth2Client = new OAuth2(
    client_id,
    client_secret,
    GOOGLE_REDIRECT_URI
  );

  // Set credentials
  oauth2Client.setCredentials({
    access_token: decryptToken(remote.tokens.access_token),
    refresh_token: remote.tokens.refresh_token ? decryptToken(remote.tokens.refresh_token) : undefined
  });

  // Check if token needs refresh
  if (remote.tokens.expires_at && Date.now() > remote.tokens.expires_at - 60000) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      // Update stored tokens
      remote.tokens.access_token = encryptToken(credentials.access_token);
      if (credentials.refresh_token) {
        remote.tokens.refresh_token = encryptToken(credentials.refresh_token);
      }
      remote.tokens.expires_at = credentials.expiry_date;

      const remotes = getRemotes();
      const r = remotes.find(r => r.name === remote.name);
      if (r) {
        r.tokens = remote.tokens;
        saveRemotes(remotes);
      }

      oauth2Client.setCredentials({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token
      });
    } catch (err) {
      console.error('[remotes] Token refresh failed:', err.message);
      throw new Error('Failed to refresh access token');
    }
  }

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// Helper: Get remote info
async function getRemoteInfo(name) {
  try {
    const remotes = getRemotes();
    const remote = remotes.find(r => r.name === name);

    if (!remote) {
      return { status: 'error', error: 'Remote not found' };
    }

    // For Google Drive, use the Google Drive API directly
    if (remote.type === 'drive' && remote.tokens) {
      try {
        const drive = await getDriveClient(remote);
        const about = await drive.about.get({ fields: 'user,storageQuota' });
        const quota = about.data.storageQuota;

        return {
          used: parseInt(quota.usage || 0),
          total: parseInt(quota.limit || 0),
          free: quota.limit ? parseInt(quota.limit) - parseInt(quota.usage || 0) : 0,
          status: 'connected'
        };
      } catch (err) {
        console.error('[remotes] Drive API error:', err.message);
        return { status: 'error', error: err.message };
      }
    }

    // For other remotes, use rclone
    try {
      const output = await execRclone(`about "${name}:" --json`);
      const info = JSON.parse(output);
      return {
        used: info.used || 0,
        total: info.total || 0,
        free: info.free || 0,
        status: 'connected'
      };
    } catch (err) {
      return { status: 'error', error: err.message };
    }
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

module.exports = router;

