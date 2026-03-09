/** @jest-environment node */

const mockCookies = {
  get: jest.fn(),
};

const progressEmitterMock = {
  initialize: jest.fn().mockResolvedValue(undefined),
  onJobLogs: jest.fn(),
  onJobProgress: jest.fn(),
};
const verifyMock = jest.fn();

jest.mock('next/server', () => ({}), { virtual: true });

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => mockCookies),
}), { virtual: true });

jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: {
    verify: verifyMock,
  },
  verify: verifyMock,
}));

jest.mock('../../lib/transfers/progressEmitter', () => ({
  progressEmitter: progressEmitterMock,
}));

const { GET } = require('../../app/api/jobs/logs/route');

function createRequest(url) {
  return new Request(url, { method: 'GET' });
}

async function readSse(response) {
  const reader = response.body && response.body.getReader();
  if (!reader) {
    throw new Error('response body missing');
  }

  const decoder = new TextDecoder();
  let output = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    output += decoder.decode(value, { stream: true });
  }

  output += decoder.decode();
  return output;
}

describe('/api/jobs/logs route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyMock.mockReset();
    mockCookies.get.mockReset();
    progressEmitterMock.initialize.mockResolvedValue(undefined);
    progressEmitterMock.onJobLogs.mockReset();
    progressEmitterMock.onJobProgress.mockReset();
    process.env.JWT_SECRET = 'test-secret';
    delete process.env.TEST_BYPASS_AUTH_USER_ID;
    mockCookies.get.mockReturnValue({ value: 'valid-token' });
    verifyMock.mockReturnValue({ id: 'user-123' });
    progressEmitterMock.onJobLogs.mockImplementation((_userId, _jobId, handler) => {
      setTimeout(() => {
        handler({
          jobId: 'job-123',
          jobType: 'transfer',
          userId: 'user-123',
          level: 'info',
          message: 'Starting transfer',
          timestamp: 123,
        });
      }, 0);
      return jest.fn();
    });
    progressEmitterMock.onJobProgress.mockImplementation((_userId, _jobId, handler) => {
      setTimeout(() => {
        handler({
          jobId: 'job-123',
          jobType: 'transfer',
          userId: 'user-123',
          progress: 100,
          status: 'completed',
          timestamp: 456,
        });
      }, 0);
      return jest.fn();
    });
  });

  test('returns 400 when jobId is missing', async () => {
    const response = await GET(createRequest('http://localhost/api/jobs/logs'));
    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain('Job ID required');
  });

  test('returns 401 when access token cookie is missing', async () => {
    mockCookies.get.mockReturnValue(undefined);
    const response = await GET(createRequest('http://localhost/api/jobs/logs?jobId=job-123'));
    expect(response.status).toBe(401);
  });

  test('returns 401 when JWT verification throws', async () => {
    verifyMock.mockImplementation(() => {
      throw new Error('invalid');
    });
    const response = await GET(createRequest('http://localhost/api/jobs/logs?jobId=job-123'));
    expect(response.status).toBe(401);
  });

  test('streams connected, log, and done events on completion', async () => {
    const unsubscribeLogs = jest.fn();
    const unsubscribeProgress = jest.fn();
    process.env.TEST_BYPASS_AUTH_USER_ID = 'user-123';

    progressEmitterMock.onJobLogs.mockImplementation((_userId, _jobId, handler) => {
      setTimeout(() => {
        handler({
          jobId: 'job-123',
          jobType: 'transfer',
          userId: 'user-123',
          level: 'info',
          message: 'Starting transfer',
          timestamp: 123,
        });
      }, 0);
      return unsubscribeLogs;
    });

    progressEmitterMock.onJobProgress.mockImplementation((_userId, _jobId, handler) => {
      setTimeout(() => {
        handler({
          jobId: 'job-123',
          jobType: 'transfer',
          userId: 'user-123',
          progress: 100,
          status: 'completed',
          timestamp: 456,
        });
      }, 0);
      return unsubscribeProgress;
    });

    const response = await GET(createRequest('http://localhost/api/jobs/logs?jobId=job-123'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');

    const output = await readSse(response);

    expect(output).toContain('event: connected');
    expect(output).toContain('"jobId":"job-123"');
    expect(output).toContain('event: log');
    expect(output).toContain('"message":"Starting transfer"');
    expect(output).toContain('event: done');
    expect(output).toContain('"status":"completed"');
    expect(unsubscribeLogs).toHaveBeenCalledTimes(1);
    expect(unsubscribeProgress).toHaveBeenCalledTimes(1);
  });

  test('streams failed done event with propagated error payload', async () => {
    process.env.TEST_BYPASS_AUTH_USER_ID = 'user-123';
    progressEmitterMock.onJobProgress.mockImplementation((_userId, _jobId, handler) => {
      setTimeout(() => {
        handler({
          jobId: 'job-123',
          jobType: 'transfer',
          userId: 'user-123',
          progress: 0,
          status: 'failed',
          timestamp: 456,
          error: 'boom',
        });
      }, 0);
      return jest.fn();
    });

    const response = await GET(createRequest('http://localhost/api/jobs/logs?jobId=job-123'));
    const output = await readSse(response);

    expect(output).toContain('event: done');
    expect(output).toContain('"status":"failed"');
    expect(output).toContain('"error":"boom"');
  });
});
