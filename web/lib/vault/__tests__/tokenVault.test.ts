/**
 * Token Vault Tests
 * 
 * Gate: AUTH-1
 * Task: 1.5@AUTH-1
 */

jest.mock('../../utils/crypto', () => ({
  encrypt: jest.fn().mockResolvedValue({ ciphertext: 'encrypted', iv: 'iv' }),
  decrypt: jest.fn().mockResolvedValue('{"token":"test-token"}'),
}));

import { loadVault, addAccount, getAccount, getProviderAccounts, removeAccount, getVaultStats } from '../tokenVault';
import { encrypt, decrypt } from '../../utils/crypto';

const mockEncrypt = encrypt as jest.MockedFunction<typeof encrypt>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;

const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: jest.fn((key: string) => this.store[key] || null),
  setItem: jest.fn((key: string, value: string) => { this.store[key] = value; }),
  removeItem: jest.fn((key: string) => { delete this.store[key]; }),
};

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      importKey: jest.fn().mockResolvedValue({}),
      deriveKey: jest.fn().mockResolvedValue({}),
    },
  },
});

describe('tokenVault', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.store = {};
  });

  describe('loadVault', () => {
    it('returns empty vault when no storage', async () => {
      const vault = await loadVault();
      expect(vault).toEqual({ entries: [], version: 1 });
    });
  });

  describe('addAccount', () => {
    it('adds account to vault', async () => {
      const vault = await addAccount({
        provider: 'google',
        accountLabel: 'Primary',
        credentials: { token: 'test' },
        isDefault: true,
      });

      expect(vault.entries.length).toBe(1);
      expect(vault.entries[0].provider).toBe('google');
    });

    it('enforces max 3 accounts per provider', async () => {
      await addAccount({ provider: 'google', accountLabel: '1', credentials: {}, isDefault: true });
      await addAccount({ provider: 'google', accountLabel: '2', credentials: {}, isDefault: false });
      await addAccount({ provider: 'google', accountLabel: '3', credentials: {}, isDefault: false });

      await expect(
        addAccount({ provider: 'google', accountLabel: '4', credentials: {}, isDefault: false })
      ).rejects.toThrow('Maximum 3 accounts allowed per provider');
    });

    it('enforces max 15 total accounts', async () => {
      for (let i = 0; i < 15; i++) {
        await addAccount({
          provider: `provider${i}`,
          accountLabel: 'Primary',
          credentials: {},
          isDefault: true,
        });
      }

      await expect(
        addAccount({ provider: 'provider15', accountLabel: 'Primary', credentials: {}, isDefault: true })
      ).rejects.toThrow('Maximum 15 total accounts allowed');
    });
  });

  describe('getAccount', () => {
    it('gets default account when no label specified', async () => {
      await addAccount({
        provider: 'google',
        accountLabel: 'Primary',
        credentials: { token: 'test' },
        isDefault: true,
      });

      const account = await getAccount('google');
      expect(account?.accountLabel).toBe('Primary');
    });

    it('returns null for non-existent account', async () => {
      const account = await getAccount('google');
      expect(account).toBeNull();
    });
  });

  describe('getProviderAccounts', () => {
    it('returns all accounts for provider', async () => {
      await addAccount({ provider: 'google', accountLabel: '1', credentials: {}, isDefault: true });
      await addAccount({ provider: 'google', accountLabel: '2', credentials: {}, isDefault: false });

      const accounts = await getProviderAccounts('google');
      expect(accounts.length).toBe(2);
    });
  });

  describe('removeAccount', () => {
    it('removes account and reorders remaining', async () => {
      await addAccount({ provider: 'google', accountLabel: '1', credentials: {}, isDefault: true });
      await addAccount({ provider: 'google', accountLabel: '2', credentials: {}, isDefault: false });

      await removeAccount('google', '1');

      const accounts = await getProviderAccounts('google');
      expect(accounts.length).toBe(1);
      expect(accounts[0].isDefault).toBe(true);
    });
  });

  describe('getVaultStats', () => {
    it('returns correct statistics', async () => {
      await addAccount({ provider: 'google', accountLabel: '1', credentials: {}, isDefault: true });
      await addAccount({ provider: 'google', accountLabel: '2', credentials: {}, isDefault: false });
      await addAccount({ provider: 'onedrive', accountLabel: '1', credentials: {}, isDefault: true });

      const stats = await getVaultStats();

      expect(stats.totalAccounts).toBe(3);
      expect(stats.providersCount).toBe(2);
      expect(stats.accountsByProvider.google).toBe(2);
    });
  });
});
