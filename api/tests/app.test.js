'use strict';

const request = require('supertest');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'test-secret';
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
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  if (header === 'Bearer admin-token') {
    req.user = { id: 'admin-1', email: 'admin@example.com', tenant_id: 'tenant-1', is_admin: true };
  } else {
    req.user = { id: 'user-1', email: 'user@example.com', tenant_id: 'tenant-1', is_admin: false };
  }

  next();
});

jest.mock('../src/middleware/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
  auditMiddleware: jest.fn((req, _res, next) => next())
}));

const app = require('../src/app');

describe('API app', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('GET /health', () => {
    test('returns ok when db is connected', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.db).toBe('connected');
    });

    test('returns 503 when db query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('db down'));

      const res = await request(app).get('/health');

      expect(res.status).toBe(503);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/db disconnected/i);
    });
  });

  describe('POST /auth/register', () => {
    test('validates required fields', async () => {
      const res = await request(app).post('/auth/register').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/email and password required/i);
    });

    test('validates minimum password length', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'user@example.com', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/password min 8 chars/i);
    });

    test('returns 409 when email already exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] });

      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'Exists@Example.com ', password: 'Password123!' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already registered/i);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE LOWER(email)=LOWER($1)',
        ['exists@example.com']
      );
    });

    test('creates user and returns token', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'u-1',
              email: 'new@example.com',
              created_at: '2026-02-25T18:00:00.000Z'
            }
          ]
        });

      const res = await request(app)
        .post('/auth/register')
        .send({ email: ' New@Example.com ', password: 'Password123!' });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('new@example.com');
      expect(res.body.token).toBeTruthy();
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'SELECT id FROM users WHERE LOWER(email)=LOWER($1)',
        ['new@example.com']
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        'INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id, email, created_at',
        ['new@example.com', expect.any(String)]
      );
    });
  });

  describe('POST /auth/login', () => {
    test('returns 400 when body is missing fields', async () => {
      const res = await request(app).post('/auth/login').send({ email: 'u@example.com' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/email and password required/i);
    });

    test('returns 401 for invalid credentials', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'missing@example.com', password: 'Password123!' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid credentials/i);
    });

    test('returns token for valid credentials', async () => {
      const password = 'Password123!';
      const passwordHash = await bcrypt.hash(password, 12);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'u-2',
            email: 'good@example.com',
            password_hash: passwordHash
          }
        ]
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: ' Good@Example.com ', password });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('good@example.com');
      expect(res.body.token).toBeTruthy();
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE LOWER(email)=LOWER($1)',
        ['good@example.com']
      );
    });
  });

  describe('route protection and public access', () => {
    test('rejects /files without bearer token', async () => {
      const res = await request(app).get('/files');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/no token provided/i);
    });

    test('rejects /storage/locations without bearer token', async () => {
      const res = await request(app).get('/storage/locations');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/no token provided/i);
    });

    test('rejects /conflicts without bearer token', async () => {
      const res = await request(app).get('/conflicts');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/no token provided/i);
    });

    test('allows public /share/:token route and returns 404 for unknown token', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/share/not-found-token');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/link not found/i);
    });
  });

  describe('authenticated route behavior', () => {
    test('GET /files returns list for authenticated user', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ column_name: 'error_reason' }, { column_name: 'retry_count' }, { column_name: 'immutable_until' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'f-1', path: 'docs/a.txt', size_bytes: 123, status: 'synced' }]
      });

      const res = await request(app)
        .get('/files')
        .set('Authorization', 'Bearer user-token');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.files[0].id).toBe('f-1');
    });

    test('GET /storage/usage returns structured usage payload', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ quota_bytes: '1000', used_bytes: '200', available_bytes: '800', used_pct: '20.00' }]
        })
        .mockResolvedValueOnce({
          rows: [{ file_type: 'Documents', file_count: '2', total_size: '400' }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'f-2', path: 'docs/b.txt', size_bytes: '300', status: 'synced', created_at: '2026-02-25T00:00:00Z' }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'f-3', path: 'docs/c.txt', size_bytes: '100', status: 'pending', created_at: '2026-02-24T00:00:00Z' }]
        });

      const res = await request(app)
        .get('/storage/usage')
        .set('Authorization', 'Bearer user-token');

      expect(res.status).toBe(200);
      expect(res.body.quota.total).toBe(1000);
      expect(res.body.quota.used).toBe(200);
      expect(Array.isArray(res.body.fileTypes)).toBe(true);
      expect(Array.isArray(res.body.largestFiles)).toBe(true);
      expect(Array.isArray(res.body.oldestFiles)).toBe(true);
    });

    test('GET /conflicts returns conflicts list', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'c-1', file_id: 'f-1', status: 'open' }]
      });

      const res = await request(app)
        .get('/conflicts')
        .set('Authorization', 'Bearer user-token');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.conflicts)).toBe(true);
      expect(res.body.conflicts[0].id).toBe('c-1');
    });

    test('GET /admin/audit denies non-admin users', async () => {
      const res = await request(app)
        .get('/admin/audit')
        .set('Authorization', 'Bearer user-token');

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/admin access required/i);
    });

    test('GET /admin/audit allows admin users', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'a-1', action: 'upload', user_id: 'user-1' }]
      });

      const res = await request(app)
        .get('/admin/audit')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.audit_logs)).toBe(true);
      expect(res.body.audit_logs[0].id).toBe('a-1');
    });
  });
});

