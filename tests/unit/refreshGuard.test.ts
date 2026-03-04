import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initRefreshGuard, getRefreshGuard, RefreshGuard } from '../../lib/auth/refreshGuard';

describe('RefreshGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return token on first call', async () => {
    const mockRefresh = vi.fn().mockResolvedValue('new-token');
    initRefreshGuard(mockRefresh);

    const guard = getRefreshGuard();
    const token = await guard.getToken();

    expect(token).toBe('new-token');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('should return same promise for concurrent calls', async () => {
    let resolveRefresh: (value: string) => void;
    const mockRefresh = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveRefresh = resolve; })
    );
    initRefreshGuard(mockRefresh);

    const guard = getRefreshGuard();
    const promise1 = guard.getToken();
    const promise2 = guard.getToken();
    const promise3 = guard.getToken();

    expect(promise1).toBe(promise2);
    expect(promise2).toBe(promise3);
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    resolveRefresh!('token');
    const results = await Promise.all([promise1, promise2, promise3]);
    expect(results).toEqual(['token', 'token', 'token']);
  });

  it('should clear promise after refresh completes', async () => {
    const mockRefresh = vi.fn().mockResolvedValue('token');
    initRefreshGuard(mockRefresh);

    const guard = getRefreshGuard();
    await guard.getToken();

    expect(guard.isRefreshing()).toBe(false);
  });

  it('should reset manually', async () => {
    const mockRefresh = vi.fn().mockResolvedValue('token');
    initRefreshGuard(mockRefresh);

    const guard = getRefreshGuard();
    await guard.getToken();
    guard.reset();

    expect(guard.isRefreshing()).toBe(false);
  });

  it('should throw if not initialized', () => {
    expect(() => getRefreshGuard()).toThrow('RefreshGuard not initialized');
  });

  it('should handle refresh failure and allow retry', async () => {
    const mockRefresh = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('success-token');
    initRefreshGuard(mockRefresh);

    const guard = getRefreshGuard();

    await expect(guard.getToken()).rejects.toThrow('Network error');
    expect(guard.isRefreshing()).toBe(false);

    const token = await guard.getToken();
    expect(token).toBe('success-token');
  });
});
