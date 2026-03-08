import jwt from 'jsonwebtoken';
// @ts-ignore - next types only available in web context
import { NextApiRequest } from 'next';
// @ts-ignore - db client from api service
import pool from '../../api/src/db/client'; // Using the existing DB client

export interface AuthenticatedUser {
  id: string;
  email: string;
  tenant_id: string;
  quota_bytes: number;
  used_bytes: number;
  is_admin: boolean;
}

/**
 * Extract and verify JWT token from request
 */
export async function authenticateToken(req: NextApiRequest): Promise<AuthenticatedUser | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET!) as { id: string };
    
    // Attach tenant_id from DB — single query
    const result = await pool.query(
      'SELECT id, email, tenant_id, quota_bytes, used_bytes FROM users WHERE id=$1',
      [decoded.id]
    );
    
    if (!result.rows.length) {
      return null;
    }
    
    const user = result.rows[0];
    
    // Determine admin status
    const adminEmail = process.env.ADMIN_EMAIL;
    const qaEnabled = String(process.env.CACHEFLOW_QA_ADMIN_ENABLED || '').toLowerCase() === 'true';
    const qaEmails = String(process.env.CACHEFLOW_QA_ADMIN_EMAILS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    user.is_admin = (adminEmail && user.email === adminEmail) || (qaEnabled && qaEmails.includes(user.email));
    
    return user;
  } catch (err) {
    console.error('Token verification error:', err);
    return null;
  }
}
