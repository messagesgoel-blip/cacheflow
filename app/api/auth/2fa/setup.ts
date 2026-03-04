import { NextApiHandler } from 'next';
import { generateTOTPSecret, generateTOTPKeyURI, generateQRCode, generateBackupCodes, hashBackupCodes } from '../../../../lib/auth/totp';
import { authenticateToken, AuthenticatedUser } from '../../../../lib/auth/utils';
import pool from '../../../../api/src/db/client';

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Generate TOTP secret
    const secret = generateTOTPSecret();
    
    // Generate key URI for QR code
    const keyUri = generateTOTPKeyURI(secret, user.email);
    
    // Generate QR code
    const qrCodeDataUrl = await generateQRCode(keyUri);
    
    // Generate backup codes
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = await hashBackupCodes(backupCodes);

    // Store the secret temporarily (will be confirmed later)
    await pool.query(
      'UPDATE users SET two_factor_secret=$1, two_factor_backup_codes=$2 WHERE id=$3',
      [Buffer.from(secret), hashedBackupCodes, user.id]
    );

    return res.status(200).json({
      qrCode: qrCodeDataUrl,
      backupCodes,
      secret, // Only for initial setup verification, not stored permanently
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default handler;