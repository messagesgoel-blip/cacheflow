/**
 * Auth Interceptor Tests
 * 
 * Gate: AUTH-1, AUTH-4
 * Task: 1.1@AUTH-1
 */

import { authInterceptor } from '../interceptors/authInterceptor';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function mockResponse(status: number, data?: any) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Map(),
  } as any as Response;
}

describe('authInterceptor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns response for non-401 status', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, { data: 'test' }));

    const result = await authInterceptor('/api/remotes/test/files');
    
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('includes credentials by default', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, { data: 'test' }));

    await authInterceptor('/api/remotes/test/files');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/remotes/test/files',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('refreshes token on 401', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(401, 'Unauthorized'))
      .mockResolvedValueOnce(mockResponse(200, { accessToken: 'new' }))
      .mockResolvedValueOnce(mockResponse(200, { data: 'test' }));

    const result = await authInterceptor('/api/remotes/test/files');
    
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('prevents concurrent refresh (singleton)', async () => {
    let resolveRefresh: (value: any) => void;
    const refreshPromise = new Promise<any>((resolve) => {
      resolveRefresh = resolve;
    });

    mockFetch
      .mockResolvedValueOnce(mockResponse(401, 'Unauthorized'))
      .mockResolvedValueOnce(mockResponse(401, 'Unauthorized'))
      .mockImplementationOnce(() => refreshPromise)
      .mockResolvedValueOnce(mockResponse(200, { data: 'test' }))
      .mockResolvedValueOnce(mockResponse(200, { data: 'test2' }));

    const p1 = authInterceptor('/api/remotes/test/files');
    const p2 = authInterceptor('/api/remotes/test/files2');

    resolveRefresh!(mockResponse(200, { accessToken: 'new' }));

    await Promise.all([p1, p2]);

    const refreshCalls = mockFetch.mock.calls.filter((call) => call[0] === '/api/auth/refresh');
    expect(refreshCalls.length).toBe(1);
  });
});

