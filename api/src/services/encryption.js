const crypto = require('crypto');

/**
 * Encryption service for sensitive data like OAuth tokens
 * Uses AES-256-GCM for encryption at rest
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Validates that the encryption key is a 64-character hex string (32 bytes)
 * @param {string} key 
 * @returns {boolean}
 */
function isValidHexKey(key) {
  if (!key || typeof key !== 'string') return false;
  return /^[0-9a-fA-F]{64}$/.test(key);
}

const ENCRYPTION_KEY_RAW = process.env.TOKEN_ENCRYPTION_KEY;

// Fail fast if missing or invalid
if (!ENCRYPTION_KEY_RAW) {
  console.error('[FATAL] TOKEN_ENCRYPTION_KEY is required for API to start.');
  process.exit(1);
}

if (!isValidHexKey(ENCRYPTION_KEY_RAW)) {
  console.error('[FATAL] TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  process.exit(1);
}

const KEY = Buffer.from(ENCRYPTION_KEY_RAW, 'hex');

/**
 * Encrypt text
 * @param {string} text 
 * @returns {string} format: iv:authTag:encryptedText
 */
function encrypt(text) {
  if (!text) return null;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt text
 * @param {string} encryptedData format: iv:authTag:encryptedText
 * @returns {string}
 */
function decrypt(encryptedData) {
  if (!encryptedData) return null;
  
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt,
  isValidHexKey,
  // Current key version for metadata
  KEY_VERSION: '1'
};

