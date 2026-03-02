/**
 * Token Vault v1
 * 
 * Encrypted at-rest storage for provider credentials.
 * Supports multi-account (up to 3 accounts per provider).
 * 
 * Gate: AUTH-1, AUTH-2
 * Task: 1.5@AUTH-1, 1.4@AUTH-2
 */

import { encrypt, decrypt } from '../utils/crypto';

const VAULT_KEY = 'cacheflow_vault_v1';
const MAX_ACCOUNTS_PER_PROVIDER = 3;
const MAX_TOTAL_ACCOUNTS = 15;

export interface VaultEntry {
  provider: string;
  accountLabel: string;
  accountOrder: number;
  isDefault: boolean;
  encryptedCredentials: string;
  remoteId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface VaultData {
  entries: VaultEntry[];
  version: number;
  lastSyncAt?: number;
}

export interface VaultAccount {
  provider: string;
  accountLabel: string;
  credentials: Record<string, any>;
  remoteId?: string;
  isDefault: boolean;
}

/**
 * Get vault encryption key (derived from user session)
 */
async function getVaultKey(): Promise<CryptoKey> {
  // In production, this should be derived from server-side session
  // For now, using a simple derivation from access token
  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('accessToken='))
    ?.split('=')[1] || 'dev-key';

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(token),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('cacheflow-vault-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Load vault from storage
 */
export async function loadVault(): Promise<VaultData> {
  try {
    const stored = localStorage.getItem(VAULT_KEY);
    if (!stored) {
      return { entries: [], version: 1 };
    }

    const key = await getVaultKey();
    const encrypted = JSON.parse(stored);
    const decrypted = await decrypt(key, encrypted.ciphertext, encrypted.iv);
    
    return JSON.parse(decrypted) as VaultData;
  } catch (error) {
    console.error('Failed to load vault:', error);
    return { entries: [], version: 1 };
  }
}

/**
 * Save vault to storage
 */
export async function saveVault(vault: VaultData): Promise<void> {
  try {
    const key = await getVaultKey();
    const plaintext = JSON.stringify(vault);
    const encrypted = await encrypt(key, plaintext);

    localStorage.setItem(VAULT_KEY, JSON.stringify({
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
    }));

    vault.lastSyncAt = Date.now();
  } catch (error) {
    console.error('Failed to save vault:', error);
    throw new Error('Vault save failed');
  }
}

/**
 * Add account to vault
 */
export async function addAccount(account: VaultAccount): Promise<VaultData> {
  const vault = await loadVault();

  // Check provider account limit
  const providerAccounts = vault.entries.filter(e => e.provider === account.provider);
  if (providerAccounts.length >= MAX_ACCOUNTS_PER_PROVIDER) {
    throw new Error(`Maximum ${MAX_ACCOUNTS_PER_PROVIDER} accounts allowed per provider`);
  }

  // Check total account limit
  if (vault.entries.length >= MAX_TOTAL_ACCOUNTS) {
    throw new Error(`Maximum ${MAX_TOTAL_ACCOUNTS} total accounts allowed`);
  }

  // Encrypt credentials
  const key = await getVaultKey();
  const encryptedCredentials = await encrypt(key, JSON.stringify(account.credentials));

  const newEntry: VaultEntry = {
    provider: account.provider,
    accountLabel: account.accountLabel || `Account ${providerAccounts.length + 1}`,
    accountOrder: providerAccounts.length + 1,
    isDefault: account.isDefault || providerAccounts.length === 0,
    encryptedCredentials: encryptedCredentials.ciphertext,
    remoteId: account.remoteId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  vault.entries.push(newEntry);
  await saveVault(vault);

  return vault;
}

/**
 * Get account by provider and label
 */
export async function getAccount(provider: string, accountLabel?: string): Promise<VaultAccount | null> {
  const vault = await loadVault();
  
  const entry = vault.entries.find(e => 
    e.provider === provider && 
    (accountLabel ? e.accountLabel === accountLabel : e.isDefault)
  );

  if (!entry) return null;

  // Decrypt credentials
  const key = await getVaultKey();
  const decrypted = await decrypt(key, entry.encryptedCredentials, entry.iv || '');
  const credentials = JSON.parse(decrypted);

  return {
    provider: entry.provider,
    accountLabel: entry.accountLabel,
    credentials,
    remoteId: entry.remoteId,
    isDefault: entry.isDefault,
  };
}

/**
 * Get all accounts for a provider
 */
export async function getProviderAccounts(provider: string): Promise<VaultAccount[]> {
  const vault = await loadVault();
  const entries = vault.entries.filter(e => e.provider === provider);

  const key = await getVaultKey();
  const accounts: VaultAccount[] = [];

  for (const entry of entries) {
    try {
      const decrypted = await decrypt(key, entry.encryptedCredentials, entry.iv || '');
      accounts.push({
        provider: entry.provider,
        accountLabel: entry.accountLabel,
        credentials: JSON.parse(decrypted),
        remoteId: entry.remoteId,
        isDefault: entry.isDefault,
      });
    } catch (error) {
      console.error(`Failed to decrypt account ${entry.accountLabel}:`, error);
    }
  }

  return accounts.sort((a, b) => a.accountOrder - b.accountOrder);
}

/**
 * Remove account
 */
export async function removeAccount(provider: string, accountLabel: string): Promise<VaultData> {
  const vault = await loadVault();
  
  const index = vault.entries.findIndex(
    e => e.provider === provider && e.accountLabel === accountLabel
  );

  if (index === -1) {
    throw new Error('Account not found');
  }

  vault.entries.splice(index, 1);

  // Reorder remaining accounts
  vault.entries
    .filter(e => e.provider === provider)
    .forEach((e, i) => {
      e.accountOrder = i + 1;
      if (i === 0) e.isDefault = true;
    });

  await saveVault(vault);
  return vault;
}

/**
 * Set default account for provider
 */
export async function setDefaultAccount(provider: string, accountLabel: string): Promise<VaultData> {
  const vault = await loadVault();

  vault.entries.forEach(e => {
    if (e.provider === provider) {
      e.isDefault = e.accountLabel === accountLabel;
    }
  });

  await saveVault(vault);
  return vault;
}

/**
 * Clear vault (logout)
 */
export async function clearVault(): Promise<void> {
  localStorage.removeItem(VAULT_KEY);
}

/**
 * Get vault stats
 */
export async function getVaultStats(): Promise<{
  totalAccounts: number;
  providersCount: number;
  accountsByProvider: Record<string, number>;
}> {
  const vault = await loadVault();
  
  const accountsByProvider: Record<string, number> = {};
  vault.entries.forEach(entry => {
    accountsByProvider[entry.provider] = (accountsByProvider[entry.provider] || 0) + 1;
  });

  return {
    totalAccounts: vault.entries.length,
    providersCount: Object.keys(accountsByProvider).length,
    accountsByProvider,
  };
}
