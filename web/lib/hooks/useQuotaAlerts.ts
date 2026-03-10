/**
 * Quota Alert Hook
 *
 * Monitors storage quota and triggers in-app notifications when thresholds are crossed.
 *
 * Gate: SSE-1
 * Task: 6.1@QUOTA-1
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/lib/hooks/useToast';
import { formatBytes } from '@/lib/providers/types';

export interface QuotaInfo {
  used: number;
  total: number;
  providerId: string;
  accountKey?: string;
}

export interface QuotaAlertConfig {
  warningThreshold?: number; // Default: 80%
  criticalThreshold?: number; // Default: 95%
  enabled?: boolean;
}

const DEFAULT_WARNING_THRESHOLD = 80;
const DEFAULT_CRITICAL_THRESHOLD = 95;

export function useQuotaAlerts(
  quotas: QuotaInfo[],
  config: QuotaAlertConfig = {}
) {
  const { warning, error } = useToast();
  const warnedProviders = useRef<Set<string>>(new Set());
  const criticalProviders = useRef<Set<string>>(new Set());

  const {
    warningThreshold = DEFAULT_WARNING_THRESHOLD,
    criticalThreshold = DEFAULT_CRITICAL_THRESHOLD,
    enabled = true,
  } = config;

  const getProviderKey = useCallback((quota: QuotaInfo) => {
    return `${quota.providerId}:${quota.accountKey || 'default'}`;
  }, []);

  const calculatePercent = useCallback((quota: QuotaInfo) => {
    if (!quota.total || quota.total === 0) return 0;
    return (quota.used / quota.total) * 100;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    quotas.forEach((quota) => {
      const percent = calculatePercent(quota);
      const providerKey = getProviderKey(quota);
      const providerName = quota.providerId.charAt(0).toUpperCase() + quota.providerId.slice(1);
      const freeSpace = Math.max(0, quota.total - quota.used);

      // Check for critical threshold (95%)
      if (percent >= criticalThreshold) {
        if (!criticalProviders.current.has(providerKey)) {
          criticalProviders.current.add(providerKey);
          error(
            `Storage Critical: ${providerName} at ${Math.round(percent)}% capacity. Only ${formatBytes(freeSpace)} remaining.`,
            'Quota Alert'
          );
        }
      }
      // Check for warning threshold (80%)
      else if (percent >= warningThreshold) {
        if (!warnedProviders.current.has(providerKey) && !criticalProviders.current.has(providerKey)) {
          warnedProviders.current.add(providerKey);
          warning(
            `Storage Low: ${providerName} at ${Math.round(percent)}% capacity. ${formatBytes(freeSpace)} remaining.`,
            'Quota Alert'
          );
        }
      }
      // Reset if below threshold
      else {
        warnedProviders.current.delete(providerKey);
        criticalProviders.current.delete(providerKey);
      }
    });
  }, [quotas, enabled, warningThreshold, criticalThreshold, calculatePercent, getProviderKey, warning, error]);

  // Provide a way to reset alert state (useful when provider is reconnected)
  const resetAlerts = useCallback(() => {
    warnedProviders.current.clear();
    criticalProviders.current.clear();
  }, []);

  // Provide a way to check current status without triggering alerts
  const getQuotaStatus = useCallback(() => {
    return quotas.map((quota) => {
      const percent = calculatePercent(quota);
      const status = percent >= criticalThreshold
        ? 'critical'
        : percent >= warningThreshold
          ? 'warning'
          : 'ok';

      return {
        ...quota,
        percent,
        status,
      };
    });
  }, [quotas, calculatePercent, warningThreshold, criticalThreshold]);

  return {
    resetAlerts,
    getQuotaStatus,
  };
}

export default useQuotaAlerts;
