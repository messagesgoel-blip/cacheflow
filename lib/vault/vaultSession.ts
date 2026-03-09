import crypto from 'crypto';

interface VaultSession {
  id: string;
  vaultId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  isValid: boolean;
}

interface VaultRecord {
  id: string;
  userId: string;
}

const sessionStore = new Map<string, VaultSession>();

class VaultSessionManager {
  private static readonly SESSION_PREFIX = 'vault_session_';
  private static readonly DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Create a new vault session
   */
  static create(vaultId: string, userId: string, ttlMs: number = this.DEFAULT_TTL): VaultSession {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    const session = {
      id: this.SESSION_PREFIX + crypto.randomBytes(32).toString('hex'),
      vaultId,
      userId,
      createdAt: now,
      expiresAt,
      isValid: true,
    };
    sessionStore.set(session.id, session);
    return session;
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
    sessionStore.set(session.id, session);
  }

  /**
   * Get TTL in milliseconds for a session
   */
  static getRemainingTtl(session: VaultSession): number {
    const now = new Date();
    const remaining = session.expiresAt.getTime() - now.getTime();
    return Math.max(0, remaining);
  }

  /**
   * Get vault by ID (stub - implement with actual storage)
   */
  static getBySessionId(sessionId: string): VaultSession | null {
    const session = sessionStore.get(sessionId) || null;
    if (!session) {
      return null;
    }
    if (!this.isValid(session)) {
      sessionStore.delete(sessionId);
      return null;
    }
    return session;
  }

  /**
   * Validate TOTP code (stub - implement with actual TOTP verification)
   */
  static async validateTOTP(_vaultId: string, code: string): Promise<boolean> {
    return /^\d{6}$/.test(code);
  }

  /**
   * Validate PIN (stub - implement with actual PIN verification)
   */
  static async validatePIN(_vaultId: string, pin: string): Promise<boolean> {
    return /^\d{4,8}$/.test(pin);
  }
}

export async function getVaultById(vaultId: string): Promise<VaultRecord | null> {
  if (!vaultId || !/^vault_[A-Za-z0-9_-]+$/.test(vaultId)) {
    return null;
  }
  return {
    id: vaultId,
    userId: `user_${vaultId.replace(/^vault_/, "")}`,
  };
}

// Re-export for backwards compatibility with route imports
export const validateVaultTOTP = VaultSessionManager.validateTOTP;
export const validateVaultPIN = VaultSessionManager.validatePIN;

export type { VaultSession };
export { VaultSessionManager };
