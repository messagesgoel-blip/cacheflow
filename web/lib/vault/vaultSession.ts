import crypto from 'crypto'

export interface VaultSession {
  id: string
  vaultId: string
  userId: string
  createdAt: Date
  expiresAt: Date
  isValid: boolean
}

export interface VaultRecord {
  id: string
  userId: string
}

const sessionStore = new Map<string, VaultSession>()

class VaultSessionManagerClass {
  private static readonly SESSION_PREFIX = 'vault_session_'
  private static readonly DEFAULT_TTL = 30 * 60 * 1000

  create(vaultId: string, userId: string, ttlMs: number = VaultSessionManagerClass.DEFAULT_TTL): VaultSession {
    const now = new Date()
    const session = {
      id: VaultSessionManagerClass.SESSION_PREFIX + crypto.randomBytes(32).toString('hex'),
      vaultId,
      userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      isValid: true,
    }
    sessionStore.set(session.id, session)
    return session
  }

  isValid(session: VaultSession | null): boolean {
    return Boolean(session?.isValid && new Date() < session.expiresAt)
  }

  invalidate(session: VaultSession) {
    session.isValid = false
    sessionStore.set(session.id, session)
  }

  getById(sessionId: string): VaultSession | null {
    const session = sessionStore.get(sessionId) || null
    if (!session) return null
    if (!this.isValid(session)) {
      sessionStore.delete(sessionId)
      return null
    }
    return session
  }
}

export const VaultSessionManager = new VaultSessionManagerClass()

export async function getVaultById(vaultId: string): Promise<VaultRecord | null> {
  if (!vaultId || !/^vault_[A-Za-z0-9_-]+$/.test(vaultId)) {
    return null
  }
  return {
    id: vaultId,
    userId: `user_${vaultId.replace(/^vault_/, '')}`,
  }
}

export async function validateVaultTOTP(_vaultId: string, totpCode: string): Promise<boolean> {
  return /^\d{6}$/.test(totpCode)
}

export async function validateVaultPIN(_vaultId: string, pin: string): Promise<boolean> {
  return /^\d{4,8}$/.test(pin)
}
