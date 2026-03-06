'use strict';

const request = require('supertest');
const fs = require('fs');
const path = require('path');

process.env.JWT_SECRET = 'test-secret';
process.env.LOCAL_CACHE_PATH = '/tmp/cacheflow-test-local';
process.env.DATABASE_URL = 'postgres://cacheflow:cacheflow@localhost:5432/cacheflow';

const mockQuery = jest.fn();

jest.mock('../src/db/client', () => ({
  query: (...args) => mockQuery(...args)
}));

jest.mock('../src/services/embeddings', () => ({
  checkApiKey: jest.fn(),
  generateEmbeddingForFile: jest.fn()
}));

jest.mock('../src/middleware/auth', () => (req, res, next) => {
  req.user = { id: 'user-1', email: 'user@example.com', tenant_id: 'tenant-1' };
  next();
});

jest.mock('../src/middleware/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
  auditMiddleware: jest.fn((req, _res, next) => next())
}));

const app = require('../src/app');

describe('Production-grade API Endpoints', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    if (!fs.existsSync(process.env.LOCAL_CACHE_PATH)) {
      fs.mkdirSync(process.env.LOCAL_CACHE_PATH, { recursive: true });
    }
  });

  describe('PATCH /api/files/rename', () => {
    test('successfully renames a file and returns standard envelope', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ path: 'old.txt' }] }) // existing check
        .mockResolvedValueOnce({ rows: [] }) // conflict check
        .mockResolvedValueOnce({ rows: [{ id: 'f1', path: 'new.txt' }] }); // update result

      const res = await request(app)
        .patch('/api/files/rename')
        .set('X-Correlation-Id', 'corr-123')
        .send({ id: 'f1', newName: 'new.txt' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.file.path).toBe('new.txt');
      expect(res.body.correlationId).toBe('corr-123');
      expect(res.body.requestId).toBeDefined();
    });

    test('returns 404 for missing file', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch('/api/files/rename')
        .send({ id: 'missing', newName: 'new.txt' });

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/file not found/i);
    });

    test('returns 400 for missing parameters', async () => {
      const res = await request(app)
        .patch('/api/files/rename')
        .send({ id: 'f1' });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('POST /api/files/move', () => {
    test('successfully moves a file', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ path: 'folder1/file.txt', size_bytes: 100 }] })
        .mockResolvedValueOnce({ rows: [] }) // conflict check
        .mockResolvedValueOnce({ rows: [{ id: 'f1', path: 'folder2/file.txt' }] });

      const res = await request(app)
        .post('/api/files/move')
        .send({ id: 'f1', newParentPath: 'folder2' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.moved).toBe(true);
    });
  });

  describe('POST /api/share', () => {
    test('successfully creates a share link', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'f1' }] })
        .mockResolvedValueOnce({ rows: [{ token: 'abc', expires_at: null }] });

      const res = await request(app)
        .post('/api/share')
        .send({ id: 'f1', expires_in_hours: 24 });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.token).toBe('abc');
    });
  });
});
