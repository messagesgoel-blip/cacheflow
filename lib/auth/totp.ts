import { TOTP } from 'otplib';
import QRCode from 'qrcode';

// Configure TOTP settings
const totp = new TOTP({
  period: 30,
  digits: 6,
  algorithm: 'sha1',
});

/**
 * Generate a new TOTP secret for a user
 */
export function generateTOTPSecret(): string {
  return totp.generateSecret();
}

/**
 * Generate a TOTP key URI for QR code generation
 */
export function generateTOTPKeyURI(secret: string, email: string, issuer: string = 'CacheFlow'): string {
  return totp.toURI({ issuer, label: email, secret });
}

/**
 * Generate QR code data URL from TOTP URI
 */
export async function generateQRCode(totpUri: string): Promise<string> {
  try {
    const qrCodeUrl = await QRCode.toDataURL(totpUri);
    return qrCodeUrl;
  } catch (error: unknown) {
    throw new Error(`Failed to generate QR code: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Verify a TOTP token against a secret
 */
export async function verifyTOTPToken(token: string, secret: string): Promise<boolean> {
  try {
    const result = await totp.verify(token, { secret });
    return !!result;
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
}

/**
 * Generate backup codes for 2FA recovery
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate a random 8-character alphanumeric code
    const code = Array.from({ length: 8 }, () => 
      Math.random().toString(36)[2] || 'a'
    ).join('').toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Hash backup codes for secure storage
 */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  // In a real implementation, you'd use a proper hashing function
  // For now, we'll simulate the hashing
  const crypto = await import('crypto');
  return codes.map(code => 
    crypto.createHash('sha256').update(code).digest('hex')
  );
}

/**
 * Verify a backup code against stored hashes
 */
export async function verifyBackupCode(inputCode: string, storedHashes: string[]): Promise<boolean> {
  const crypto = await import('crypto');
  const inputHash = crypto.createHash('sha256').update(inputCode).digest('hex');
  
  return storedHashes.includes(inputHash);
}
