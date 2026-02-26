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

    // Create the remote using rclone
    const configStr = Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Use rclone config create
    await execRclone(`config create "${name}" "${type}" ${configStr}`);

    // Add to our config
    remotes.push({
      id: Date.now().toString(),
      name,
      type,
      provider: provider || type,
      config: config, // Store for UI (in production, encrypt this)
      createdAt: new Date().toISOString()
    });

    saveRemotes(remotes);

    res.json({ success: true, remote: { id: remotes[remotes.length - 1].id, name, type, provider } });
  } catch (err) {
    console.error('[remotes] add:', err.message);
    res.status(500).json({ error: err.message || 'failed to add remote' });
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
    exec(fullCmd, { timeout: 30000 }, (err, stdout, stderr) => {
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
