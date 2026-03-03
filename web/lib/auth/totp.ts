/**
 * TOTP (Time-based One-Time Password) Utilities
 * 
 * Implements RFC 6238 TOTP for 2FA authentication.
 * 
 * Gate: 2FA-1
 * Task: 2.13@2FA-1
 */

import { sign, verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

/**
 * Generate a random base32 secret
 */
export function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const randomValues = new Uint8Array(32);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < 32; i++) {
    secret += chars[randomValues[i] % chars.length];
  }
  
  return secret;
}

/**
 * Generate TOTP code from secret and timestamp
 */
export function generateTOTP(secret: string, timestamp: number = Date.now()): string {
  const period = 30; // 30 second period
  const digits = 6;
  
  // Calculate time step
  const timeStep = Math.floor(timestamp / 1000 / period);
  
  // Convert timeStep to big-endian buffer
  const timeBuffer = new ArrayBuffer(8);
  const timeView = new DataView(timeBuffer);
  timeView.setBigUint64(0, BigInt(timeStep), false);
  
  // HMAC-SHA1
  const encoder = new TextEncoder();
  const keyData = base32ToBytes(secret);
  
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  ).then(async (key) => {
    const signature = await crypto.subtle.sign('HMAC', key, timeBuffer);
    const hmac = new Uint8Array(signature);
    
    // Dynamic truncation
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24) |
                 ((hmac[offset + 1] & 0xff) << 16) |
                 ((hmac[offset + 2] & 0xff) << 8) |
                 (hmac[offset + 3] & 0xff);
    
    // Pad to 6 digits
    return (code % Math.pow(10, digits)).toString().padStart(digits, '0');
  });
}

/**
 * Verify TOTP code
 */
export async function verifyTOTP(secret: string, code: string, window: number = 1): Promise<boolean> {
  const period = 30;
  const currentTime = Date.now();
  
  // Check current and adjacent time windows (to handle clock skew)
  for (let i = -window; i <= window; i++) {
    const checkTime = currentTime + (i * period * 1000);
    const expectedCode = await generateTOTP(secret, checkTime);
    if (expectedCode === code) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate QR code data URI for TOTP setup
 */
export function generateQRCodeDataURI(issuer: string, accountName: string, secret: string): string {
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  
  // Simple QR code placeholder - in production use a QR library
  // This returns the otpauth URL which can be rendered as QR
  return otpauthUrl;
}

/**
 * Generate backup codes
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  
  for (let i = 0; i < count; i++) {
    let code = '';
    const randomValues = new Uint8Array(8);
    crypto.getRandomValues(randomValues);
    
    for (let j = 0; j < 8; j++) {
      code += chars[randomValues[j] % chars.length];
    }
    
    // Format as XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  
  return codes;
}

/**
 * Hash backup code for storage
 */
export async function hashBackupCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.toLowerCase().replace('-', ''));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify backup code against stored hashes
 */
export async function verifyBackupCode(code: string, hashedCodes: string[]): Promise<boolean> {
  const hashed = await hashBackupCode(code);
  return hashedCodes.includes(hashed);
}

/**
 * Convert base32 string to bytes
 */
function base32ToBytes(base32: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  
  for (const char of base32.toUpperCase()) {
    const index = chars.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(5, '0');
  }
  
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
  }
  
  return bytes;
}

/**
 * Generate 2FA session token
 */
export function generate2FASessionToken(userId: string, email: string): string {
  return sign(
    { 
      userId, 
      email, 
      type: '2fa_pending',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
    },
    JWT_SECRET
  );
}

/**
 * Verify 2FA session token
 */
export function verify2FASessionToken(token: string): { userId: string; email: string } | null {
  try {
    const payload = verify(token, JWT_SECRET) as any;
    if (payload.type !== '2fa_pending') {
      return null;
    }
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}
