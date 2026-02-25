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
      expect(res.body.status).toBe('ok');
      expect(res.body.db).toBe('connected');
    });

    test('returns 503 when db query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('db down'));

      const res = await request(app).get('/health');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('error');
      expect(res.body.db).toBe('disconnected');
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
        .send({ email: 'exists@example.com', password: 'Password123!' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already registered/i);
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
        .send({ email: 'new@example.com', password: 'Password123!' });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('new@example.com');
      expect(res.body.token).toBeTruthy();
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
        .send({ email: 'good@example.com', password });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('good@example.com');
      expect(res.body.token).toBeTruthy();
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
});
