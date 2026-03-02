/**
 * Security Audit Tests
 * 
 * Gate: AUTH-2
 * Task: 1.18@AUTH-2
 */

import { scanForSecrets, sanitizeForClient, withSecurityScan, validateEnvConfig } from '../securityAudit';

describe('securityAudit', () => {
  describe('scanForSecrets', () => {
    it('detects forbidden fields', () => {
      const obj = {
        user: { id: '1', email: 'test@example.com' },
        jwtSecret: 'super-secret-key',
      };

      const leaks = scanForSecrets(obj);

      expect(leaks.some(l => l.includes('jwtSecret'))).toBe(true);
    });

    it('detects secret-like field names', () => {
      const obj = {
        apiKey: 'key-123',
        password: 'pass-456',
        token: 'tok-789',
      };

      const leaks = scanForSecrets(obj);

      expect(leaks.length).toBeGreaterThan(0);
    });

    it('detects JWT tokens in values', () => {
      const obj = {
        data: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
      };

      const leaks = scanForSecrets(obj);

      expect(leaks.some(l => l.includes('data'))).toBe(true);
    });

    it('allows safe fields', () => {
      const obj = {
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
      };

      const leaks = scanForSecrets(obj);

      expect(leaks.length).toBe(0);
    });

    it('scans nested objects', () => {
      const obj = {
        response: {
          data: {
            user: {
              apiKey: 'secret-key',
            },
          },
        },
      };

      const leaks = scanForSecrets(obj);

      expect(leaks.some(l => l.includes('response.data.user.apiKey'))).toBe(true);
    });

    it('scans arrays', () => {
      const obj = {
        users: [
          { id: '1', email: 'a@example.com' },
          { id: '2', password: 'secret' },
        ],
      };

      const leaks = scanForSecrets(obj);

      expect(leaks.some(l => l.includes('[1].password'))).toBe(true);
    });
  });

  describe('sanitizeForClient', () => {
    it('removes forbidden fields', () => {
      const obj = {
        user: { id: '1', email: 'test@example.com' },
        jwtSecret: 'should-be-removed',
        accessToken: 'should-be-removed',
      };

      const sanitized = sanitizeForClient(obj);

      expect(sanitized.jwtSecret).toBeUndefined();
      expect(sanitized.accessToken).toBeUndefined();
      expect(sanitized.user).toBeDefined();
    });

    it('preserves safe fields', () => {
      const obj = {
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
        },
        settings: {
          theme: 'dark',
        },
      };

      const sanitized = sanitizeForClient(obj);

      expect(sanitized).toEqual(obj);
    });

    it('recursively sanitizes nested objects', () => {
      const obj = {
        response: {
          data: {
            user: { id: '1', apiKey: 'secret' },
            safe: 'value',
          },
        },
      };

      const sanitized = sanitizeForClient(obj);

      expect(sanitized.response.data.user.apiKey).toBeUndefined();
      expect(sanitized.response.data.safe).toBe('value');
    });
  });

  describe('validateEnvConfig', () => {
    it('returns missing secrets', () => {
      // Save original
      const originalJwt = process.env.JWT_SECRET;
      
      // Remove JWT_SECRET
      delete process.env.JWT_SECRET;
      
      const missing = validateEnvConfig();
      
      expect(missing.some(m => m === 'JWT_SECRET')).toBe(true);
      
      // Restore
      if (originalJwt) process.env.JWT_SECRET = originalJwt;
    });
  });
});
