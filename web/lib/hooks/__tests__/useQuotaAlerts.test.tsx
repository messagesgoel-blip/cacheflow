/**
 * Tests for useQuotaAlerts hook
 *
 * Gate: SSE-1
 * Task: 6.1@QUOTA-1
 */

import { renderHook, act } from '@testing-library/react';
import { useQuotaAlerts, type QuotaInfo } from '../useQuotaAlerts';

const mockWarningToast = jest.fn();
const mockErrorToast = jest.fn();

jest.mock('../useToast', () => ({
  useToast: () => ({
    warning: mockWarningToast,
    error: mockErrorToast,
  }),
}));

describe('useQuotaAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWarningToast.mockReset();
    mockErrorToast.mockReset();
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
    expect(mockWarningToast).not.toHaveBeenCalled();
    expect(mockErrorToast).not.toHaveBeenCalled();
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
    expect(mockWarningToast).toHaveBeenCalledWith(
      'Storage Low: Google at 85% capacity. 15 B remaining.',
      'Quota Alert'
    );
    expect(mockErrorToast).not.toHaveBeenCalled();
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
    expect(mockErrorToast).toHaveBeenCalledWith(
      'Storage Critical: Dropbox at 96% capacity. Only 4 B remaining.',
      'Quota Alert'
    );
    expect(mockWarningToast).not.toHaveBeenCalled();
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
    expect(mockWarningToast).toHaveBeenCalledTimes(1);
    expect(mockErrorToast).toHaveBeenCalledTimes(1);
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

  it('should allow alerts to re-fire after reset and rerender', () => {
    const initialQuotas: QuotaInfo[] = [
      { used: 85, total: 100, providerId: 'google' },
    ];

    const { result, rerender } = renderHook(({ currentQuotas }) => useQuotaAlerts(currentQuotas, {
      warningThreshold: 80,
      criticalThreshold: 95,
      enabled: true,
    }), {
      initialProps: { currentQuotas: initialQuotas },
    });

    let status = result.current.getQuotaStatus();
    expect(status[0].status).toBe('warning');
    expect(mockWarningToast).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.resetAlerts();
    });

    rerender({ currentQuotas: [...initialQuotas] });

    status = result.current.getQuotaStatus();
    expect(status[0].status).toBe('warning');
    expect(mockWarningToast).toHaveBeenCalledTimes(2);
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
    expect(mockWarningToast).toHaveBeenCalledTimes(1);
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
    expect(mockWarningToast).toHaveBeenCalledTimes(2);
  });
});
