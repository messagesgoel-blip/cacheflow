import { NextApiHandler } from 'next';
import { authenticateToken } from '../../../../lib/auth/utils';
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

    // Disable 2FA for the user
    await pool.query(
      'UPDATE users SET two_factor_enabled=false, two_factor_secret=NULL, two_factor_backup_codes=NULL, two_factor_disabled_at=NOW() WHERE id=$1',
      [user.id]
    );

    return res.status(200).json({ 
      success: true,
      message: '2FA disabled successfully' 
    });
  } catch (error) {
    console.error('2FA disable error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default handler;