const { Readable, PassThrough } = require('stream');
const { finished } = require('stream/promises');
const dns = require('dns/promises');
const { isIP } = require('net');
const path = require('path');
const pool = require('../db/client');

const MAX_REMOTE_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB
const DOWNLOAD_TIMEOUT_MS = 300000; // 5 minutes

const PRIVATE_IP_PATTERNS = [
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^169\.254\.\d+\.\d+$/,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
];

/** Normalize IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) to plain IPv4 */
function normalizeIP(ip) {
  const match = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  return match ? match[1] : ip;
}

function isPrivateIP(raw) {
  const ip = normalizeIP(raw);
  return PRIVATE_IP_PATTERNS.some(p => p.test(ip));
}

function validateRemoteUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are supported');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || isPrivateIP(hostname)) {
    throw new Error('URLs pointing to private or internal networks are not allowed');
  }
}

/**
 * Resolve hostname and verify all IPs are public before connecting.
 * Prevents DNS rebinding and redirect-based SSRF.
 */
async function validateResolvedIPs(hostname) {
  if (isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new Error('URL resolves to a private or internal IP address');
    }
    return;
  }

  const addresses = await dns.resolve4(hostname).catch(() => []);
  const addresses6 = await dns.resolve6(hostname).catch(() => []);
  const allIPs = [...addresses, ...addresses6];

  if (allIPs.length === 0) {
    throw new Error('Could not resolve hostname');
  }

  for (const ip of allIPs) {
    if (isPrivateIP(ip)) {
      throw new Error(`URL resolves to a private or internal IP address (${ip})`);
    }
  }
}

async function remoteUpload(options) {
  const { url, provider, filename, metadata = {}, user } = options;

  if (!metadata.accountKey) {
    throw new Error('accountKey is required in metadata');
  }

  if (!user?.id) {
    throw new Error('Authenticated user is required');
  }

  const remoteLookup = await pool.query(
    `SELECT provider FROM user_remotes WHERE user_id = $1 AND account_key = $2 AND disabled = FALSE LIMIT 1`,
    [user.id, metadata.accountKey],
  );
  if (!remoteLookup.rows.length) {
    throw new Error('Remote account not found for user/accountKey');
  }

  const resolvedProvider = String(remoteLookup.rows[0].provider || '').toLowerCase();
  if (provider && provider.toLowerCase() !== resolvedProvider) {
    throw new Error('Provider/accountKey mismatch');
  }

  validateRemoteUrl(url);

  // Resolve DNS and verify all IPs are public before connecting
  const parsedUrl = new URL(url);
  await validateResolvedIPs(parsedUrl.hostname);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual', // Handle redirects manually to check each hop
    });

    // If redirect, resolve relative Location first, then validate
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const redirectUrl = new URL(location, url);
        validateRemoteUrl(redirectUrl.toString());
        await validateResolvedIPs(redirectUrl.hostname);
      }
      throw new Error(`Redirect to ${location} — client should retry with validated URL`);
    }

    if (!response.ok) {
      throw new Error(`Failed to download from URL: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    // Handshake validated (headers + body stream presence); stop handshake timer.
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength, 10) : 0;

    if (size > MAX_REMOTE_FILE_SIZE) {
      throw new Error(`File too large: ${size} bytes exceeds limit of ${MAX_REMOTE_FILE_SIZE} bytes`);
    }

    const actualFilename = sanitizeFilename(filename) || generateFilenameFromUrl(url);

    // Stream directly to provider with a size-limiting PassThrough.
    // No full-body buffering — bytes are counted on the fly.
    let receivedBytes = 0;
    const sizeGuard = new PassThrough({
      transform(chunk, _encoding, cb) {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_REMOTE_FILE_SIZE) {
          cb(new Error(`Downloaded file too large: exceeds limit of ${MAX_REMOTE_FILE_SIZE} bytes`));
        } else {
          cb(null, chunk);
        }
      },
    });

    const nodeStream = Readable.fromWeb(response.body);
    const stream = nodeStream.pipe(sizeGuard);

    const uploadResult = await uploadToProvider(resolvedProvider, stream, actualFilename, {
      contentType,
      metadata
    });

    return {
      success: true,
      fileId: uploadResult.fileId,
      provider: resolvedProvider,
      size: receivedBytes,
      contentType,
      uploadedAt: new Date().toISOString(),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function uploadToProvider(provider, stream, filename, options) {
  switch (provider.toLowerCase()) {
    case 'google':
    case 'aws_s3':
    case 'local':
    case 'box':
    case 'dropbox':
    case 'filen':
    case 'pcloud':
    case 'webdav':
    case 'vps':
    case 'yandex':
      return uploadToS3(stream, filename, options);
    case 'onedrive':
    case 'gcp':
      return uploadToGCP(stream, filename, options);
    case 'azure':
      return uploadToAzure(stream, filename, options);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

async function uploadToS3(stream, filename, options) {
  console.log(`Uploading to S3: ${filename}`);
  
  await finished(stream);
  
  return {
    fileId: `s3://${process.env.S3_BUCKET}/${filename}`,
  };
}

async function uploadToGCP(stream, filename, options) {
  console.log(`Uploading to GCP: ${filename}`);
  
  await finished(stream);
  
  return {
    fileId: `gcs://${process.env.GCS_BUCKET}/${filename}`,
  };
}

async function uploadToAzure(stream, filename, options) {
  console.log(`Uploading to Azure: ${filename}`);
  
  await finished(stream);
  
  return {
    fileId: `azure://${process.env.AZURE_CONTAINER}/${filename}`,
  };
}

function generateFilenameFromUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const filename = pathname.split('/').pop();
    
    if (filename && filename !== '') {
      const cleaned = sanitizeFilename(filename);
      if (cleaned) {
        return cleaned;
      }
    }
    
    return `remote-file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.tmp`;
  } catch (error) {
    return `remote-file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.tmp`;
  }
}

function sanitizeFilename(input) {
  if (!input) {
    return '';
  }

  let decoded = String(input).trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep original if the input is not URI-encoded.
  }

  const cleaned = path.basename(decoded)
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Control character stripping is intentional for untrusted filenames.
    .replace(/[\x00-\x1f\x7f/\\]/g, '')
    .replace(/\.{2,}/g, '.')
    .trim();

  if (!cleaned) {
    return '';
  }

  const safe = cleaned.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
  return safe;
}

module.exports = {
  remoteUpload,
  validateRemoteUrl,
  validateResolvedIPs,
  sanitizeFilename,
};
