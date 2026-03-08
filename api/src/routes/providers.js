const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const multer = require('multer');
const pool = require('../db/client');
const authMw = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const vpsPool = require('../services/vpsConnectionPool');
const { Client } = require('ssh2');

const router = express.Router();
router.use(authMw);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 2, // 2MB max PEM/upload buffer per request
  },
});

const KEY_HEX = process.env.TOKEN_ENCRYPTION_KEY || '';
if (!/^[0-9a-fA-F]{64}$/.test(KEY_HEX)) {
  throw new Error('TOKEN_ENCRYPTION_KEY must be a 64-char hex key');
}
const ENC_KEY = Buffer.from(KEY_HEX, 'hex');

function encryptPem(pemBuffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(pemBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    pemKey: Buffer.concat([encrypted, authTag]),
    pemIv: iv,
  };
}

function decryptPem(pemKeyBuffer, pemIvBuffer) {
  if (!Buffer.isBuffer(pemKeyBuffer) || pemKeyBuffer.length <= 16) {
    throw new Error('Encrypted PEM payload is invalid');
  }
  const authTag = pemKeyBuffer.subarray(pemKeyBuffer.length - 16);
  const encrypted = pemKeyBuffer.subarray(0, pemKeyBuffer.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, pemIvBuffer);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function parsePort(rawPort) {
  const parsed = Number.parseInt(String(rawPort ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) return 22;
  return parsed;
}

function parseRemotePath(rawPath, fallback = '') {
  if (!rawPath || typeof rawPath !== 'string') return fallback;
  return rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
}

function parseSingleByteRange(rangeHeader, totalSize) {
  if (!rangeHeader || typeof rangeHeader !== 'string') return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (totalSize <= 0) return null;

  if (rawStart === '' && rawEnd === '') return null;

  if (rawStart === '') {
    const suffixLength = Number.parseInt(rawEnd, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    const start = Math.max(totalSize - suffixLength, 0);
    return { start, end: totalSize - 1 };
  }

  const start = Number.parseInt(rawStart, 10);
  const end = rawEnd === '' ? totalSize - 1 : Number.parseInt(rawEnd, 10);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start || start >= totalSize) return null;

  return { start, end: Math.min(end, totalSize - 1) };
}

function ensurePemFile(file) {
  if (!file || !file.buffer) throw new Error('PEM key file is required');
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext !== '.pem' && ext !== '.key') throw new Error('pemFile must use .pem or .key extension');
  const pemText = file.buffer.toString('utf8');
  if (!pemText.startsWith('-----BEGIN')) throw new Error('Invalid PEM format');
  return pemText;
}

function dryRunSftpConnect({ host, port, username, privateKey }) {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let hostFingerprint = null;
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error('SSH connection timed out'));
    }, 15000);

    client.once('ready', () => {
      client.sftp((sftpErr, sftp) => {
        if (sftpErr) {
          clearTimeout(timeout);
          client.end();
          reject(sftpErr);
          return;
        }
        sftp.readdir('/', (readErr) => {
          clearTimeout(timeout);
          try {
            sftp.end();
          } catch {}
          client.end();
          if (readErr) {
            reject(readErr);
            return;
          }
          resolve({
            hostFingerprint,
          });
        });
      });
    });

    client.once('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    client.connect({
      host,
      port,
      username,
      privateKey,
      hostHash: 'sha256',
      hostVerifier: (hashedKey) => {
        hostFingerprint = typeof hashedKey === 'string' ? `SHA256:${hashedKey}` : null;
        return true;
      },
      readyTimeout: 15000,
    });
  });
}

async function resolvePemTextForRequest(req, existingConnection) {
  if (req.file) {
    return ensurePemFile(req.file);
  }

  if (existingConnection?.pem_key && existingConnection?.pem_iv) {
    return decryptPem(existingConnection.pem_key, existingConnection.pem_iv).toString('utf8');
  }

  throw new Error('PEM key file is required');
}

function parseConnectionInput(body = {}) {
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const host = typeof body.host === 'string' ? body.host.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const port = parsePort(body.port);

  return { label, host, username, port };
}

async function testVpsConnectionInput({ host, port, username, pemText }) {
  return dryRunSftpConnect({
    host,
    port,
    username,
    privateKey: pemText,
  });
}

async function getVpsConnection(id, userId) {
  const result = await pool.query(
    `SELECT id, user_id, label, host, port, username, auth_method, pem_key, pem_iv,
            last_tested_at, last_host_fingerprint, created_at, updated_at
     FROM vps_connections
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  if (result.rowCount === 0) return null;
  return result.rows[0];
}

function toConnectionPayload(row) {
  return {
    id: row.id,
    label: row.label,
    host: row.host,
    port: row.port,
    username: row.username,
    authMethod: row.auth_method,
    lastTestedAt: row.last_tested_at,
    lastHostFingerprint: row.last_host_fingerprint,
    createdAt: row.created_at,
  };
}

function openSftp(client) {
  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) return reject(err);
      resolve(sftp);
    });
  });
}

function sftpReaddir(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.readdir(remotePath, (err, list) => {
      if (err) return reject(err);
      resolve(list || []);
    });
  });
}

function sftpStat(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.stat(remotePath, (err, stats) => {
      if (err) return reject(err);
      resolve(stats);
    });
  });
}

function sftpMkdir(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.mkdir(remotePath, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function sftpUnlink(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.unlink(remotePath, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function sftpRmdir(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.rmdir(remotePath, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function sftpRename(sftp, oldPath, newPath) {
  return new Promise((resolve, reject) => {
    sftp.rename(oldPath, newPath, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function sftpCreateReadStream(sftp, remotePath) {
  return sftp.createReadStream(remotePath);
}

function sftpCreateWriteStream(sftp, remotePath) {
  return sftp.createWriteStream(remotePath);
}

async function withSftpSession(connection, handler) {
  const privateKeyPem = decryptPem(connection.pem_key, connection.pem_iv).toString('utf8');
  const entry = await vpsPool.acquire(connection.id, {
    host: connection.host,
    port: connection.port,
    username: connection.username,
    privateKey: privateKeyPem,
    readyTimeout: 15000,
  });

  let broken = false;
  try {
    const sftp = await openSftp(entry.client);
    try {
      return await handler(sftp);
    } finally {
      try {
        sftp.end();
      } catch {}
    }
  } catch (err) {
    broken = true;
    throw err;
  } finally {
    vpsPool.release(connection.id, entry, broken);
  }
}

router.post('/vps', upload.single('pemFile'), async (req, res) => {
  const { label, host, username, port } = parseConnectionInput(req.body);

  if (!label || !host || !username) {
    return res.status(400).json({ error: 'label, host, and username are required' });
  }

  let pemText;
  try {
    pemText = ensurePemFile(req.file);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  let testResult;
  try {
    testResult = await testVpsConnectionInput({ host, port, username, pemText });
  } catch (err) {
    return res.status(400).json({
      error: 'Connection test failed',
      detail: err.message,
    });
  }

  try {
    const encryptedPem = encryptPem(Buffer.from(pemText, 'utf8'));
    const id = crypto.randomUUID();
    const inserted = await pool.query(
      `INSERT INTO vps_connections (
         id, user_id, label, host, port, username, auth_method, pem_key, pem_iv,
         last_tested_at, last_host_fingerprint, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'pem', $7, $8, NOW(), $9, NOW(), NOW())
       RETURNING id, label, host, port, username, auth_method, last_tested_at, last_host_fingerprint, created_at`,
      [id, req.user.id, label, host, port, username, encryptedPem.pemKey, encryptedPem.pemIv, testResult?.hostFingerprint || null]
    );

    await auditLog(req.user.id, 'vps_connect', 'provider', id, req, {
      label,
      host,
      port,
      username,
    });

    return res.status(201).json(toConnectionPayload(inserted.rows[0]));
  } catch (err) {
    console.error('[providers:vps] create error:', err.message);
    return res.status(500).json({ error: 'Failed to save VPS connection' });
  }
});

router.post('/vps/test', upload.single('pemFile'), async (req, res) => {
  const { host, username, port } = parseConnectionInput(req.body);
  if (!host || !username) {
    return res.status(400).json({ error: 'host and username are required' });
  }

  let pemText;
  try {
    pemText = await resolvePemTextForRequest(req);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const testResult = await testVpsConnectionInput({ host, port, username, pemText });
    return res.json({
      success: true,
      message: 'Connection successful',
      hostFingerprint: testResult?.hostFingerprint || null,
    });
  } catch (err) {
    return res.status(400).json({
      error: 'Connection test failed',
      detail: err.message,
    });
  }
});

router.get('/vps', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, label, host, port, username, auth_method, created_at, updated_at
              , last_tested_at, last_host_fingerprint
       FROM vps_connections
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({
      success: true,
      data: result.rows.map((row) => ({
        ...toConnectionPayload(row),
        updatedAt: row.updated_at,
        provider: 'vps',
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve VPS connections' });
  }
});

router.post('/vps/:id/test', upload.single('pemFile'), async (req, res) => {
  const connection = await getVpsConnection(req.params.id, req.user.id);
  if (!connection) return res.status(404).json({ error: 'VPS connection not found' });

  const { host, username, port } = parseConnectionInput({
    host: req.body?.host ?? connection.host,
    username: req.body?.username ?? connection.username,
    port: req.body?.port ?? connection.port,
  });

  if (!host || !username) {
    return res.status(400).json({ error: 'host and username are required' });
  }

  let pemText;
  try {
    pemText = await resolvePemTextForRequest(req, connection);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const testResult = await testVpsConnectionInput({ host, port, username, pemText });
    const previousHostFingerprint = connection.last_host_fingerprint || null;
    const nextHostFingerprint = testResult?.hostFingerprint || null;
    const fingerprintChanged = Boolean(
      previousHostFingerprint &&
      nextHostFingerprint &&
      previousHostFingerprint !== nextHostFingerprint
    );
    await pool.query(
      `UPDATE vps_connections
       SET last_tested_at = NOW(),
           last_host_fingerprint = $1,
           updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [nextHostFingerprint, connection.id, req.user.id]
    );
    await auditLog(req.user.id, 'vps_test', 'provider', connection.id, req, {
      host,
      port,
      username,
    });
    return res.json({
      success: true,
      message: 'Connection successful',
      hostFingerprint: nextHostFingerprint,
      previousHostFingerprint,
      fingerprintChanged,
    });
  } catch (err) {
    return res.status(400).json({
      error: 'Connection test failed',
      detail: err.message,
    });
  }
});

router.patch('/vps/:id', upload.single('pemFile'), async (req, res) => {
  const connection = await getVpsConnection(req.params.id, req.user.id);
  if (!connection) return res.status(404).json({ error: 'VPS connection not found' });

  const fallbackBody = {
    label: req.body?.label ?? connection.label,
    host: req.body?.host ?? connection.host,
    username: req.body?.username ?? connection.username,
    port: req.body?.port ?? connection.port,
  };
  const { label, host, username, port } = parseConnectionInput(fallbackBody);

  if (!label || !host || !username) {
    return res.status(400).json({ error: 'label, host, and username are required' });
  }

  let pemText;
  try {
    pemText = await resolvePemTextForRequest(req, connection);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  let testResult;
  try {
    testResult = await testVpsConnectionInput({ host, port, username, pemText });
  } catch (err) {
    return res.status(400).json({
      error: 'Connection test failed',
      detail: err.message,
    });
  }

  try {
    const encryptedPem = req.file ? encryptPem(Buffer.from(pemText, 'utf8')) : null;
    const updated = await pool.query(
      `UPDATE vps_connections
       SET label = $1,
           host = $2,
           port = $3,
           username = $4,
           pem_key = COALESCE($5, pem_key),
           pem_iv = COALESCE($6, pem_iv),
           last_tested_at = NOW(),
           last_host_fingerprint = $7,
           updated_at = NOW()
       WHERE id = $8 AND user_id = $9
       RETURNING id, label, host, port, username, auth_method, last_tested_at, last_host_fingerprint, created_at, updated_at`,
      [
        label,
        host,
        port,
        username,
        encryptedPem?.pemKey || null,
        encryptedPem?.pemIv || null,
        testResult?.hostFingerprint || null,
        connection.id,
        req.user.id,
      ]
    );

    await auditLog(req.user.id, 'vps_update', 'provider', connection.id, req, {
      label,
      host,
      port,
      username,
      keyUpdated: Boolean(req.file),
    });

    return res.json({
      success: true,
      data: {
        ...toConnectionPayload(updated.rows[0]),
        updatedAt: updated.rows[0].updated_at,
        provider: 'vps',
      },
    });
  } catch (err) {
    console.error('[providers:vps] update error:', err.message);
    return res.status(500).json({ error: 'Failed to update VPS connection' });
  }
});

router.get('/vps/:id/files', async (req, res) => {
  const connection = await getVpsConnection(req.params.id, req.user.id);
  if (!connection) return res.status(404).json({ error: 'VPS connection not found' });

  const remotePath = parseRemotePath(req.query.path, '/');
  try {
    const items = await withSftpSession(connection, async (sftp) => {
      const list = await sftpReaddir(sftp, remotePath);
      return list.map((item) => ({
        name: item.filename,
        type: item.attrs?.isDirectory?.() ? 'dir' : 'file',
        size: Number(item.attrs?.size || 0),
        modifiedAt: item.attrs?.mtime
          ? new Date(Number(item.attrs.mtime) * 1000).toISOString()
          : null,
      }));
    });
    return res.json(items);
  } catch (err) {
    return res.status(400).json({ error: 'Failed to list directory', detail: err.message });
  }
});

router.get('/vps/:id/files/download', async (req, res) => {
  const connection = await getVpsConnection(req.params.id, req.user.id);
  if (!connection) return res.status(404).json({ error: 'VPS connection not found' });
  const remotePath = parseRemotePath(req.query.path);
  if (!remotePath) return res.status(400).json({ error: 'path is required' });

  let poolEntry;
  try {
    const privateKeyPem = decryptPem(connection.pem_key, connection.pem_iv).toString('utf8');
    poolEntry = await vpsPool.acquire(connection.id, {
      host: connection.host,
      port: connection.port,
      username: connection.username,
      privateKey: privateKeyPem,
      readyTimeout: 15000,
    });
    const sftp = await openSftp(poolEntry.client);
    const stats = await sftpStat(sftp, remotePath);
    if (stats.isDirectory()) {
      try { sftp.end(); } catch {}
      vpsPool.release(connection.id, poolEntry, false);
      return res.status(400).json({ error: 'Cannot download a directory' });
    }

    const totalSize = Number(stats.size || 0);
    const range = parseSingleByteRange(req.headers.range, totalSize);
    if (req.headers.range && !range && totalSize > 0) {
      try { sftp.end(); } catch {}
      vpsPool.release(connection.id, poolEntry, false);
      res.setHeader('Content-Range', `bytes */${totalSize}`);
      return res.status(416).json({ error: 'Requested range not satisfiable' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(remotePath)}"`);
    res.setHeader('Accept-Ranges', 'bytes');

    if (totalSize === 0) {
      res.setHeader('Content-Length', '0');
      try { sftp.end(); } catch {}
      vpsPool.release(connection.id, poolEntry, false);
      return res.status(200).end();
    }

    const streamStart = range ? range.start : 0;
    const streamEnd = range ? range.end : totalSize - 1;
    const contentLength = streamEnd - streamStart + 1;

    if (range) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${streamStart}-${streamEnd}/${totalSize}`);
    }

    res.setHeader('Content-Length', String(contentLength));

    let released = false;
    const release = (broken) => {
      if (released) return;
      released = true;
      try { sftp.end(); } catch {}
      vpsPool.release(connection.id, poolEntry, broken);
    };

    const readStream = sftp.createReadStream(remotePath, { start: streamStart, end: streamEnd });
    readStream.on('error', (err) => {
      release(true);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed', detail: err.message });
      } else {
        res.end();
      }
    });
    res.on('close', () => {
      release(false);
    });

    await pipeline(readStream, res);
    release(false);
  } catch (err) {
    if (poolEntry) vpsPool.release(connection.id, poolEntry, true);
    return res.status(400).json({ error: 'Download failed', detail: err.message });
  }
});

router.post('/vps/:id/files/upload', upload.single('file'), async (req, res) => {
  const connection = await getVpsConnection(req.params.id, req.user.id);
  if (!connection) return res.status(404).json({ error: 'VPS connection not found' });
  if (!req.file) return res.status(400).json({ error: 'file is required' });

  let remotePath = parseRemotePath(req.query.path);
  if (!remotePath) return res.status(400).json({ error: 'path is required' });
  if (remotePath.endsWith('/')) {
    remotePath = `${remotePath}${req.file.originalname}`;
  }

  try {
    await withSftpSession(connection, async (sftp) => {
      const writeStream = sftp.createWriteStream(remotePath);
      await pipeline(Readable.from(req.file.buffer), writeStream);
    });
    return res.status(201).json({
      uploaded: true,
      path: remotePath,
      size: req.file.size,
    });
  } catch (err) {
    return res.status(400).json({ error: 'Upload failed', detail: err.message });
  }
});

router.post('/vps/:id/files/rename', async (req, res) => {
  const connection = await getVpsConnection(req.params.id, req.user.id);
  if (!connection) return res.status(404).json({ error: 'VPS connection not found' });

  const sourcePath = parseRemotePath(req.body?.path);
  const newName = typeof req.body?.newName === 'string' ? req.body.newName.trim() : '';
  if (!sourcePath) return res.status(400).json({ error: 'path is required' });
  if (!newName) return res.status(400).json({ error: 'newName is required' });
  if (newName.includes('/')) return res.status(400).json({ error: 'newName must not contain path separators' });

  const destinationPath = path.posix.join(path.posix.dirname(sourcePath), newName);

  try {
    await withSftpSession(connection, async (sftp) => {
      await sftpRename(sftp, sourcePath, destinationPath);
    });
    return res.json({ renamed: true, path: destinationPath });
  } catch (err) {
    return res.status(400).json({ error: 'Rename failed', detail: err.message });
  }
});

router.post('/vps/:id/files/move', async (req, res) => {
  const connection = await getVpsConnection(req.params.id, req.user.id);
  if (!connection) return res.status(404).json({ error: 'VPS connection not found' });

  const sourcePath = parseRemotePath(req.body?.sourcePath);
  const destinationPath = parseRemotePath(req.body?.destinationPath);
  if (!sourcePath || !destinationPath) {
    return res.status(400).json({ error: 'sourcePath and destinationPath are required' });
  }

  try {
    await withSftpSession(connection, async (sftp) => {
      await sftpRename(sftp, sourcePath, destinationPath);
    });
    return res.json({ moved: true, path: destinationPath });
  } catch (err) {
    return res.status(400).json({ error: 'Move failed', detail: err.message });
  }
});

router.post('/vps/:id/files/copy', async (req, res) => {
  const connection = await getVpsConnection(req.params.id, req.user.id);
  if (!connection) return res.status(404).json({ error: 'VPS connection not found' });

  const sourcePath = parseRemotePath(req.body?.sourcePath);
  const destinationPath = parseRemotePath(req.body?.destinationPath);
  if (!sourcePath || !destinationPath) {
    return res.status(400).json({ error: 'sourcePath and destinationPath are required' });
  }

  try {
    await withSftpSession(connection, async (sftp) => {
      const stats = await sftpStat(sftp, sourcePath);
      if (stats.isDirectory()) {
        throw new Error('Directory copy is not supported');
      }
      await pipeline(
        sftpCreateReadStream(sftp, sourcePath),
        sftpCreateWriteStream(sftp, destinationPath)
      );
    });
    return res.status(201).json({ copied: true, path: destinationPath });
  } catch (err) {
    return res.status(400).json({ error: 'Copy failed', detail: err.message });
  }
});

router.delete('/vps/:id/files', async (req, res) => {
  const connection = await getVpsConnection(req.params.id, req.user.id);
  if (!connection) return res.status(404).json({ error: 'VPS connection not found' });
  const remotePath = parseRemotePath(req.query.path);
  if (!remotePath) return res.status(400).json({ error: 'path is required' });

  try {
    await withSftpSession(connection, async (sftp) => {
      const stats = await sftpStat(sftp, remotePath);
      if (stats.isDirectory()) {
        await sftpRmdir(sftp, remotePath);
      } else {
        await sftpUnlink(sftp, remotePath);
      }
    });
    return res.json({ deleted: true, path: remotePath });
  } catch (err) {
    return res.status(400).json({ error: 'Delete failed', detail: err.message });
  }
});

router.post('/vps/:id/files/mkdir', async (req, res) => {
  const connection = await getVpsConnection(req.params.id, req.user.id);
  if (!connection) return res.status(404).json({ error: 'VPS connection not found' });
  const remotePath = parseRemotePath(req.query.path);
  if (!remotePath) return res.status(400).json({ error: 'path is required' });

  try {
    await withSftpSession(connection, async (sftp) => {
      await sftpMkdir(sftp, remotePath);
    });
    return res.status(201).json({ created: true, path: remotePath });
  } catch (err) {
    return res.status(400).json({ error: 'mkdir failed', detail: err.message });
  }
});

router.delete('/vps/:id', async (req, res) => {
  try {
    await vpsPool.drain(req.params.id);
    const result = await pool.query(
      'DELETE FROM vps_connections WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'VPS connection not found' });
    }
    await auditLog(req.user.id, 'vps_disconnect', 'provider', req.params.id, req, {});
    return res.json({ deleted: true });
  } catch (err) {
    console.error('[providers:vps] disconnect error:', err.message);
    return res.status(500).json({ error: 'Failed to disconnect VPS provider' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const remoteDelete = await pool.query(
      'DELETE FROM user_remotes WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (remoteDelete.rowCount > 0) {
      return res.json({ deleted: true });
    }

    const vpsDelete = await pool.query(
      'DELETE FROM vps_connections WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (vpsDelete.rowCount > 0) {
      await vpsPool.drain(req.params.id);
      return res.json({ deleted: true });
    }

    return res.status(404).json({ error: 'Provider connection not found' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to disconnect provider', detail: err.message });
  }
});

module.exports = router;
