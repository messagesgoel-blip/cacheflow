/**
 * Cookie Auth Tests
 * 
 * Gate: AUTH-3
 * Task: 1.3@AUTH-3
 */

import { setAuthCookies, getAccessToken, getRefreshToken, getUserData, clearAuthCookies, isAuthenticated } from '../cookieAuth';

// Mock next/headers cookies
const mockCookies = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

jest.mock('next/headers', () => ({
  cookies: () => mockCookies,
}));

describe('cookieAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setAuthCookies', () => {
    it('sets access token cookie with correct options', async () => {
      await setAuthCookies('access-token-123', 'refresh-token-456', {
        userId: 'user-1',
        email: 'test@example.com',
      });

      expect(mockCookies.set).toHaveBeenCalledWith(
        'accessToken',
        'access-token-123',
        expect.objectContaining({
          httpOnly: true,
          maxAge: 15 * 60,
        })
      );
    });

    it('sets refresh token cookie with restricted path', async () => {
      await setAuthCookies('access-token-123', 'refresh-token-456', {
        userId: 'user-1',
        email: 'test@example.com',
      });

      expect(mockCookies.set).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token-456',
        expect.objectContaining({
          httpOnly: true,
          path: '/api/auth',
          maxAge: 7 * 24 * 60 * 60,
        })
      );
    });

    it('sets user data cookie as readable by client', async () => {
      await setAuthCookies('access-token-123', 'refresh-token-456', {
        userId: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(mockCookies.set).toHaveBeenCalledWith(
        'userData',
        JSON.stringify({ userId: 'user-1', email: 'test@example.com', name: 'Test User' }),
        expect.objectContaining({
          httpOnly: false,
        })
      );
    });
  });

  describe('getAccessToken', () => {
    it('returns access token from cookie', async () => {
      mockCookies.get.mockReturnValue({ value: 'access-token-123' });

      const token = await getAccessToken();

      expect(token).toBe('access-token-123');
      expect(mockCookies.get).toHaveBeenCalledWith('accessToken');
    });

    it('returns undefined if no access token', async () => {
      mockCookies.get.mockReturnValue(undefined);

      const token = await getAccessToken();

      expect(token).toBeUndefined();
    });
  });

  describe('getRefreshToken', () => {
    it('returns refresh token from cookie', async () => {
      mockCookies.get.mockReturnValue({ value: 'refresh-token-456' });

      const token = await getRefreshToken();

      expect(token).toBe('refresh-token-456');
    });
  });

  describe('getUserData', () => {
    it('parses and returns user data', async () => {
      const userData = { userId: 'user-1', email: 'test@example.com' };
      mockCookies.get.mockReturnValue({ value: JSON.stringify(userData) });

      const result = await getUserData();

      expect(result).toEqual(userData);
    });

    it('returns null on parse error', async () => {
      mockCookies.get.mockReturnValue({ value: 'invalid-json' });

      const result = await getUserData();

      expect(result).toBeNull();
    });

    it('returns null if no cookie', async () => {
      mockCookies.get.mockReturnValue(undefined);

      const result = await getUserData();

      expect(result).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns true if access token exists', async () => {
      mockCookies.get.mockReturnValue({ value: 'access-token' });

      const authenticated = await isAuthenticated();

      expect(authenticated).toBe(true);
    });

    it('returns false if no access token', async () => {
      mockCookies.get.mockReturnValue(undefined);

      const authenticated = await isAuthenticated();

      expect(authenticated).toBe(false);
    });
  });

  describe('clearAuthCookies', () => {
    it('deletes all auth cookies', async () => {
      await clearAuthCookies();

      expect(mockCookies.delete).toHaveBeenCalledWith('accessToken');
      expect(mockCookies.delete).toHaveBeenCalledWith('refreshToken');
      expect(mockCookies.delete).toHaveBeenCalledWith('userData');
    });
  });
});

