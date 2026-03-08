const { Readable } = require('stream');
const { finished } = require('stream/promises');

const MAX_REMOTE_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB
const DOWNLOAD_TIMEOUT_MS = 300000; // 5 minutes

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
  const blockedPatterns = [
    /^localhost$/,
    /^127\.\d+\.\d+\.\d+$/,
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^0\.0\.0\.0$/,
    /^\[?::1\]?$/,
    /^169\.254\.\d+\.\d+$/,
    /^fc00:/i,
    /^fe80:/i,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      throw new Error('URLs pointing to private or internal networks are not allowed');
    }
  }
}

async function remoteUpload(options) {
  const { url, provider, filename, metadata = {} } = options;

  validateRemoteUrl(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to download from URL: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength, 10) : 0;

    if (size > MAX_REMOTE_FILE_SIZE) {
      throw new Error(`File too large: ${size} bytes exceeds limit of ${MAX_REMOTE_FILE_SIZE} bytes`);
    }

    const actualFilename = filename || generateFilenameFromUrl(url);

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > MAX_REMOTE_FILE_SIZE) {
      throw new Error(`Downloaded file too large: ${buffer.byteLength} bytes exceeds limit of ${MAX_REMOTE_FILE_SIZE} bytes`);
    }
    const stream = Readable.from(Buffer.from(buffer));

    const uploadResult = await uploadToProvider(provider, stream, actualFilename, {
      contentType,
      metadata
    });

    return {
      success: true,
      fileId: uploadResult.fileId,
      provider,
      size,
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
    case 'aws_s3':
      return uploadToS3(stream, filename, options);
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
      return filename;
    }
    
    return `remote-file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.tmp`;
  } catch (error) {
    return `remote-file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.tmp`;
  }
}

module.exports = {
  remoteUpload,
  validateRemoteUrl
};