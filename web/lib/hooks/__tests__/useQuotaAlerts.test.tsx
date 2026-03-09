/**
 * Tests for useQuotaAlerts hook
 *
 * Gate: SSE-1
 * Task: 6.1@QUOTA-1
 */

import { renderHook, act } from '@testing-library/react';
import { useQuotaAlerts, type QuotaInfo } from '../useQuotaAlerts';

// Mock the toast hook
jest.mock('../useToast', () => ({
  useToast: () => ({
    warning: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('useQuotaAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not trigger alerts when quota is below threshold', () => {
    const quotas: QuotaInfo[] = [
      { used: 10, total: 100, providerId: 'google' },
    ];

    const { result } = renderHook(() => useQuotaAlerts(quotas, {
      warningThreshold: 80,
      criticalThreshold: 95,
    }));

    const status = result.current.getQuotaStatus();
    expect(status[0].percent).toBe(10);
    expect(status[0].status).toBe('ok');
  });

  it('should trigger warning when quota exceeds 80%', () => {
    const quotas: QuotaInfo[] = [
      { used: 85, total: 100, providerId: 'google' },
    ];

    const { result } = renderHook(() => useQuotaAlerts(quotas, {
      warningThreshold: 80,
      criticalThreshold: 95,
      enabled: true,
    }));

    const status = result.current.getQuotaStatus();
    expect(status[0].percent).toBe(85);
    expect(status[0].status).toBe('warning');
  });

  it('should trigger critical alert when quota exceeds 95%', () => {
    const quotas: QuotaInfo[] = [
      { used: 96, total: 100, providerId: 'dropbox' },
    ];

    const { result } = renderHook(() => useQuotaAlerts(quotas, {
      warningThreshold: 80,
      criticalThreshold: 95,
      enabled: true,
    }));

    const status = result.current.getQuotaStatus();
    expect(status[0].percent).toBe(96);
    expect(status[0].status).toBe('critical');
  });

  it('should handle multiple providers with different thresholds', () => {
    const quotas: QuotaInfo[] = [
      { used: 50, total: 100, providerId: 'google' },
      { used: 85, total: 100, providerId: 'dropbox' },
      { used: 96, total: 100, providerId: 'onedrive' },
    ];

    const { result } = renderHook(() => useQuotaAlerts(quotas, {
      warningThreshold: 80,
      criticalThreshold: 95,
    }));

    const status = result.current.getQuotaStatus();
    expect(status[0].status).toBe('ok');
    expect(status[1].status).toBe('warning');
    expect(status[2].status).toBe('critical');
  });

  it('should handle providers without quota data', () => {
    const quotas: QuotaInfo[] = [
      { used: 0, total: 0, providerId: 'vps' },
    ];

    const { result } = renderHook(() => useQuotaAlerts(quotas, {
      warningThreshold: 80,
      criticalThreshold: 95,
    }));

    const status = result.current.getQuotaStatus();
    expect(status[0].percent).toBe(0);
    expect(status[0].status).toBe('ok');
  });

  it('should allow resetting alerts', () => {
    const quotas: QuotaInfo[] = [
      { used: 85, total: 100, providerId: 'google' },
    ];

    const { result } = renderHook(() => useQuotaAlerts(quotas, {
      warningThreshold: 80,
      criticalThreshold: 95,
      enabled: true,
    }));

    // Get status before reset
    let status = result.current.getQuotaStatus();
    expect(status[0].status).toBe('warning');

    // Reset
    act(() => {
      result.current.resetAlerts();
    });

    // Should still report same status (but alert state is cleared)
    status = result.current.getQuotaStatus();
    expect(status[0].status).toBe('warning');
  });

  it('should respect custom threshold configuration', () => {
    const quotas: QuotaInfo[] = [
      { used: 50, total: 100, providerId: 'google' },
    ];

    // Custom thresholds at 50% and 75%
    const { result } = renderHook(() => useQuotaAlerts(quotas, {
      warningThreshold: 50,
      criticalThreshold: 75,
    }));

    const status = result.current.getQuotaStatus();
    expect(status[0].percent).toBe(50);
    expect(status[0].status).toBe('warning'); // 50% >= 50% warning threshold
  });

  it('should handle account-specific providers', () => {
    const quotas: QuotaInfo[] = [
      { used: 85, total: 100, providerId: 'google', accountKey: 'user1@example.com' },
      { used: 85, total: 100, providerId: 'google', accountKey: 'user2@example.com' },
    ];

    const { result } = renderHook(() => useQuotaAlerts(quotas, {
      warningThreshold: 80,
      criticalThreshold: 95,
    }));

    const status = result.current.getQuotaStatus();
    expect(status).toHaveLength(2);
    expect(status[0].status).toBe('warning');
    expect(status[1].status).toBe('warning');
  });
});
