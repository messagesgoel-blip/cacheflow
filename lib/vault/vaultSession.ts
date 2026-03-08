import crypto from 'crypto';

interface VaultSession {
  id: string;
  vaultId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  isValid: boolean;
}

class VaultSessionManager {
  private static readonly SESSION_PREFIX = 'vault_session_';
  private static readonly DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Create a new vault session
   */
  static create(vaultId: string, userId: string, ttlMs: number = this.DEFAULT_TTL): VaultSession {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    
    return {
      id: this.SESSION_PREFIX + crypto.randomBytes(32).toString('hex'),
      vaultId,
      userId,
      createdAt: now,
      expiresAt,
      isValid: true,
    };
  }

  /**
   * Validate a vault session exists and is not expired
   */
  static isValid(session: VaultSession | null): boolean {
    if (!session) return false;
    if (!session.isValid) return false;
    return new Date() < session.expiresAt;
  }

  /**
   * Invalidate a vault session
   */
  static invalidate(session: VaultSession): void {
    session.isValid = false;
  }

  /**
   * Get TTL in milliseconds for a session
   */
  static getRemainingTtl(session: VaultSession): number {
    const now = new Date();
    const remaining = session.expiresAt.getTime() - now.getTime();
    return Math.max(0, remaining);
  }
}

export type { VaultSession };
export { VaultSessionManager };