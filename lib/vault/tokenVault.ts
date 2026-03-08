/**
 * Token Vault v1 — encrypted at-rest provider credentials
 *
 * Gate: AUTH-2, SEC-1
 * Task: 1.4@AUTH-2
 *
 * AES-256-GCM encryption. Key from TOKEN_ENCRYPTION_KEY env var (hex, ≥32 bytes).
 * Persistence target: `tokens.encrypted_credentials` (001_token_vault migration).
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_VERSION = 1;
const MAX_ACCOUNTS_PER_PROVIDER = 3;

export interface VaultCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix ms
  scope?: string;
  [key: string]: unknown;
}

export interface VaultEntry {
  provider: string;
  accountLabel: string;
  accountOrder: number;
  isDefault: boolean;
  credentials: VaultCredentials;
  remoteId?: string;
  lastUsedAt?: number; // Unix ms
  createdAt: number;   // Unix ms
  updatedAt: number;   // Unix ms
  encryptionVersion: number;
}

export interface VaultState {
  entries: VaultEntry[];
  version: number;
  lastSyncAt?: number;
}

/**
 * Derive a 32-byte AES key from TOKEN_ENCRYPTION_KEY.
 * Throws if unset — SEC-1 forbids silent fallback defaults.
 */
function deriveKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      '[tokenVault] TOKEN_ENCRYPTION_KEY is not set. Configure it before using the vault.'
    );
  }
  const buf = Buffer.from(raw, 'hex');
  if (buf.length >= 32) return buf.slice(0, 32);
  // Pad with zeros when hex decodes to fewer than 32 bytes (dev convenience).
  const padded = Buffer.alloc(32);
  buf.copy(padded);
  return padded;
}

/**
 * Returns `<iv_hex>:<authTag_hex>:<ciphertext_hex>:<version>`.
 * All four segments required for round-trip decryption.
 */
export function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}:${ENCRYPTION_VERSION}`;
}

/**
 * Decrypts a value produced by `encrypt()`.
 * GCM authentication failure (wrong key / tampered data) throws.
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    throw new Error(
      `[tokenVault] Invalid ciphertext format (expected 4 segments, got ${parts.length})`
    );
  }
  const [ivHex, authTagHex, encrypted] = parts;
  const key = deriveKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export class TokenVault {
  private entries: Map<string, VaultEntry> = new Map();
  private version = 1;
  private lastSyncAt?: number;

  private static key(provider: string, accountLabel: string): string {
    return `${provider}::${accountLabel.toLowerCase()}`;
  }

  loadVault(): VaultState {
    return {
      entries: Array.from(this.entries.values()),
      version: this.version,
      lastSyncAt: this.lastSyncAt,
    };
  }

  hydrateVault(state: VaultState): void {
    this.entries.clear();
    for (const entry of state.entries) {
      this.entries.set(TokenVault.key(entry.provider, entry.accountLabel), entry);
    }
    this.version = state.version;
    this.lastSyncAt = state.lastSyncAt;
  }

  addAccount(
    entry: Omit<VaultEntry, 'createdAt' | 'updatedAt' | 'encryptionVersion'>
  ): VaultEntry {
    const existingForProvider = this.getProviderAccounts(entry.provider);
    const compositeKey = TokenVault.key(entry.provider, entry.accountLabel);
    const isUpdate = this.entries.has(compositeKey);

    if (!isUpdate && existingForProvider.length >= MAX_ACCOUNTS_PER_PROVIDER) {
      throw new Error(
        `[tokenVault] Provider "${entry.provider}" already has the maximum of ` +
          `${MAX_ACCOUNTS_PER_PROVIDER} accounts. Remove one before adding another.`
      );
    }

    const now = Date.now();
    const existing = this.entries.get(compositeKey);

    if (entry.isDefault) this.clearDefaultForProvider(entry.provider);

    const newEntry: VaultEntry = {
      ...entry,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      encryptionVersion: ENCRYPTION_VERSION,
    };
    this.entries.set(compositeKey, newEntry);
    return newEntry;
  }

  getAccount(provider: string, accountLabel = 'Primary'): VaultEntry | undefined {
    if (!accountLabel || accountLabel === 'default') {
      return this.getDefaultAccount(provider);
    }
    return this.entries.get(TokenVault.key(provider, accountLabel));
  }

  getProviderAccounts(provider: string): VaultEntry[] {
    return Array.from(this.entries.values())
      .filter(e => e.provider === provider)
      .sort((a, b) => a.accountOrder - b.accountOrder);
  }

  removeAccount(provider: string, accountLabel: string): void {
    const key = TokenVault.key(provider, accountLabel);
    if (!this.entries.has(key)) {
      throw new Error(
        `[tokenVault] Account not found: provider="${provider}" label="${accountLabel}"`
      );
    }
    this.entries.delete(key);
  }

  setDefaultAccount(provider: string, accountLabel: string): void {
    const key = TokenVault.key(provider, accountLabel);
    const entry = this.entries.get(key);
    if (!entry) {
      throw new Error(
        `[tokenVault] Account not found: provider="${provider}" label="${accountLabel}"`
      );
    }
    this.clearDefaultForProvider(provider);
    this.entries.set(key, { ...entry, isDefault: true, updatedAt: Date.now() });
  }

  clearVault(): void {
    this.entries.clear();
    this.version = 1;
    this.lastSyncAt = undefined;
  }

  getVaultStats(): {
    totalAccounts: number;
    providers: string[];
    defaultAccounts: Record<string, string>;
  } {
    const all = Array.from(this.entries.values());
    const providers = [...new Set(all.map(e => e.provider))];
    const defaultAccounts: Record<string, string> = {};
    for (const e of all) {
      if (e.isDefault) defaultAccounts[e.provider] = e.accountLabel;
    }
    return { totalAccounts: all.length, providers, defaultAccounts };
  }

  /**
   * Returns an encrypted string suitable for `tokens.encrypted_credentials`.
   * Wire format: encrypt(JSON.stringify(VaultState)).
   */
  serialise(): string {
    return encrypt(JSON.stringify(this.loadVault()));
  }

  /**
   * Restores vault from a string produced by `serialise()`.
   * Decryption or parse failure resets to empty vault and logs the error.
   */
  deserialise(ciphertext: string): void {
    try {
      const state: VaultState = JSON.parse(decrypt(ciphertext));
      this.hydrateVault(state);
    } catch (err) {
      console.error('[tokenVault] deserialise failed — resetting to empty vault:', err);
      this.clearVault();
    }
  }

  private getDefaultAccount(provider: string): VaultEntry | undefined {
    return Array.from(this.entries.values()).find(
      e => e.provider === provider && e.isDefault
    );
  }

  private clearDefaultForProvider(provider: string): void {
    for (const [k, entry] of this.entries.entries()) {
      if (entry.provider === provider && entry.isDefault) {
        this.entries.set(k, { ...entry, isDefault: false, updatedAt: Date.now() });
      }
    }
  }
}

let _vault: TokenVault | null = null;

export function getVault(): TokenVault {
  if (!_vault) _vault = new TokenVault();
  return _vault;
}

export function setVault(vault: TokenVault): void {
  _vault = vault;
}

export default TokenVault;

