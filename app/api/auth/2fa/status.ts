import { NextApiHandler } from 'next';
import { authenticateToken } from '../../../../lib/auth/utils';
import pool from '../../../../api/src/db/client';

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get 2FA status for the user
    const result = await pool.query(
      'SELECT two_factor_enabled, two_factor_enabled_at, two_factor_disabled_at FROM users WHERE id=$1',
      [user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = result.rows[0];

    return res.status(200).json({ 
      twoFactorEnabled: userData.two_factor_enabled,
      twoFactorEnabledAt: userData.two_factor_enabled_at,
      twoFactorDisabledAt: userData.two_factor_disabled_at,
    });
  } catch (error) {
    console.error('2FA status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default handler;