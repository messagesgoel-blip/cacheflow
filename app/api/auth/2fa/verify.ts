import { NextApiHandler } from 'next';
import { verifyTOTPToken } from '../../../../lib/auth/totp';
import { authenticateToken } from '../../../../lib/auth/utils';
import pool from '../../../../api/src/db/client';

interface VerifyRequestBody {
  token: string;
}

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

    const { token } = req.body as VerifyRequestBody;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Get user's 2FA secret
    const result = await pool.query(
      'SELECT two_factor_secret FROM users WHERE id=$1',
      [user.id]
    );

    if (!result.rows.length || !result.rows[0].two_factor_secret) {
      return res.status(400).json({ error: '2FA not initialized for this user' });
    }

    // Convert buffer back to string for verification
    const secret = result.rows[0].two_factor_secret.toString();

    // Try to verify the token
    const isValid = verifyTOTPToken(token, secret);

    if (isValid) {
      // Enable 2FA for the user since token verification passed
      await pool.query(
        'UPDATE users SET two_factor_enabled=true, two_factor_enabled_at=NOW() WHERE id=$1',
        [user.id]
      );

      return res.status(200).json({ 
        success: true,
        message: '2FA setup verified successfully' 
      });
    } else {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid token. Please try again.' 
      });
    }
  } catch (error) {
    console.error('2FA verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default handler;