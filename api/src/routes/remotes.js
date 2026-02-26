const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const authMw = require('../middleware/auth');

const router = express.Router();
router.use(authMw);

const REMOTES_CONFIG_FILE = process.env.REMOTES_CONFIG_FILE || '/app/data/remotes.json';

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

    // Use rclone to list the remote
    const output = await execRclone(`lsjson "${name}:${remotePath}"`);

    const entries = JSON.parse(output);
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

    if (!name || !type || !config) {
      return res.status(400).json({ error: 'name, type, and config required' });
    }

    const remotes = getRemotes();

    // Check for duplicate name
    if (remotes.some(r => r.name === name)) {
      return res.status(409).json({ error: 'remote with this name already exists' });
    }

    // For Google Drive, we need OAuth token - create config and get authorize command
    let needsOAuth = false;
    let authorizeCommand = null;
    let tokenValue = null;

    if (type === 'drive' && config.client_id && config.client_secret) {
      // Encode credentials for authorize command
      const creds = Buffer.from(JSON.stringify({
        client_id: config.client_id,
        client_secret: config.client_secret
      })).toString('base64');

      // Create rclone config with non-interactive mode to get OAuth URL
      try {
        const authorizeOutput = await execRclone(
          `config create "${name}" "${type}" client_id="${config.client_id}" client_secret="${config.client_secret}" config_is_local=false --json`
        );

        const result = JSON.parse(authorizeOutput);

        // Check if it needs a token (result has Option with config_token)
        if (result.Option && result.Option.Name === 'config_token') {
          needsOAuth = true;
          authorizeCommand = result.Option.Help.split('\n').find(line => line.includes('rclone authorize'));
          tokenValue = creds; // Store encoded credentials for later
        }
      } catch (e) {
        // If non-interactive fails, try regular create - might work for other providers
        const configStr = Object.entries(config)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');
        await execRclone(`config create "${name}" "${type}" ${configStr}`);
      }
    } else {
      // Create the remote using rclone for non-drive types
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
      config: config,
      status: needsOAuth ? 'pending_oauth' : 'connected',
      createdAt: new Date().toISOString()
    };

    remotes.push(remote);
    saveRemotes(remotes);

    const response = { success: true, remote: { id: remote.id, name, type, provider } };

    // If needs OAuth, add authorize info to response
    if (needsOAuth && authorizeCommand) {
      response.needsOAuth = true;
      response.authorizeCommand = authorizeCommand.replace('rclone authorize', '/usr/local/bin/rclone authorize');
      response.credentials = tokenValue; // Base64 encoded {client_id, client_secret}
    }

    res.json(response);
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

    // The token is the raw JSON from rclone authorize: {"access_token":"...","refresh_token":"...","token_type":"Bearer",...}
    // The credentials is the base64 encoded {client_id, client_secret}
    let creds;
    if (credentials) {
      creds = JSON.parse(Buffer.from(credentials, 'base64').toString());
    } else {
      // Fallback: try to get from stored config
      creds = remote.config;
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
    await execRclone(`config delete "${name}"`);

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

// Helper: Get remote info
async function getRemoteInfo(name) {
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
}

module.exports = router;
