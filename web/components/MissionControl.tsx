'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useBanners, useActionCenter } from './ActionCenterProvider'
import { useTransferContext } from '@/context/TransferContext'
import { formatBytes } from '@/lib/providers/types'
import apiClient from '@/lib/apiClient'

/**
 * MissionControl Component
 * 
 * Integrated hub for system status, storage stats, and action progress.
 * Designed to fit naturally within the page shell like a Grafana status row.
 */
export default function MissionControl() {
  const banners = useBanners()
  const { dismissBanner } = useActionCenter()
  const { transfers, activeCount } = useTransferContext()
  const [activityData, setActivityData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  const [isMounted, setIsMounted] = useState(false)
  const [quotas, setQuotas] = useState<{ used: number; total: number }>({ used: 0, total: 0 })
  const [realProviderCount, setRealProviderCount] = useState(0)

  const [connections, setConnections] = useState<any[]>([])

  useEffect(() => {
    setIsMounted(true)
    
    // Fetch system data (activity + quotas)
    const fetchSystemData = async () => {
      try {
        // 1. Fetch Activity for sparkline
        const actRes = await fetch('/api/activity?limit=20')
        const actPayload = await actRes.json()
        if (actPayload?.ok && Array.isArray(actPayload.data?.activity)) {
          setActivityData(prev => [...prev.slice(1), actPayload.data.activity.length % 12])
        } else {
          // Deterministic low signal fallback
          setActivityData(prev => [...prev.slice(1), 0])
        }

        // 2. Fetch Connections/Quotas for storage stats and provider count
        const connResult = await apiClient.getConnections()
        if (connResult.success && Array.isArray(connResult.data)) {
          setConnections(connResult.data)
          let used = 0
          let total = 0
          let count = 0
          connResult.data.forEach((conn: any) => {
            count++
            if (conn.quota) {
              used += conn.quota.used || 0
              total += conn.quota.total || 0
            }
          })
          setQuotas({ used, total })
          setRealProviderCount(count)
        }
      } catch (e) {
        // Deterministic fallback
        setActivityData(prev => [...prev.slice(1), 0])
      }
    }

    const interval = setInterval(fetchSystemData, 30000)
    void fetchSystemData()
    return () => clearInterval(interval)
  }, [])

  // Progress Prioritization Helper
  const prioritizedTask = useMemo(() => {
    const progressBanners = banners.filter(b => b.kind === 'progress')
    
    // 1. Connection/Bootstrap/Auth tasks
    const authTask = progressBanners.find(b => 
      b.key?.includes('auth') || 
      b.key?.includes('conn') || 
      b.title.toLowerCase().includes('connect') ||
      b.title.toLowerCase().includes('authenticating')
    )
    if (authTask) return { type: 'banner' as const, task: authTask }

    // 2. Active transfer tasks
    const activeTransfers = transfers.filter(t => t.status === 'active' || t.status === 'waiting')
    if (activeTransfers.length > 0) return { type: 'transfer' as const, tasks: activeTransfers }

    // 3. Other progress tasks
    if (progressBanners.length > 0) return { type: 'banner' as const, task: progressBanners[0] }

    return null
  }, [banners, transfers])

  const operationLabel = useMemo(() => {
    if (!prioritizedTask) return null

    if (prioritizedTask.type === 'banner') {
      const b = prioritizedTask.task
      return `${b.title}${b.message ? `: ${b.message}` : ''}`
    }

    const active = prioritizedTask.tasks
    if (active.length === 1) {
      const t = active[0]
      const op = t.operation ? t.operation.charAt(0).toUpperCase() + t.operation.slice(1) : 'Processing'
      return `${op} "${t.fileName}"`
    }
    return `Coordinating ${active.length} parallel operations`
  }, [prioritizedTask])

  const aggregateProgress = useMemo(() => {
    if (!prioritizedTask) return null
    if (prioritizedTask.type === 'banner') return prioritizedTask.task.progress ?? 0
    
    const active = prioritizedTask.tasks
    const totalProgress = active.reduce((sum, t) => sum + (t.progress || 0), 0)
    return Math.round(totalProgress / active.length)
  }, [prioritizedTask])

  const activeAlert = useMemo(() => {
    if (banners.length === 0) return null
    // Filter out progress banners as they are handled in the progress bar section
    const nonProgress = banners.filter(b => b.kind !== 'progress')
    if (nonProgress.length === 0) return null
    const errors = nonProgress.filter(b => b.kind === 'error')
    if (errors.length > 0) return errors[errors.length - 1]
    return nonProgress[nonProgress.length - 1]
  }, [banners])

  if (!isMounted) return null

  const hasSystemActivity = prioritizedTask !== null || banners.length > 0
  const quotaPercent = quotas.total > 0 ? (quotas.used / quotas.total) * 100 : 0

  return (
    <div 
      data-testid="cf-mission-control"
      className="mb-6 w-full animate-in fade-in duration-500"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_320px]">
        
        {/* Left: System Integrity & Sparkline */}
        <div className="cf-panel flex items-center justify-between gap-4 rounded-[28px] p-5">
          <div className="min-w-0">
            <div className="cf-kicker leading-none">Control Plane</div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${hasSystemActivity ? 'bg-[var(--cf-blue)] animate-pulse' : 'bg-[var(--cf-green)]'}`} />
              <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--cf-text-1)] whitespace-nowrap">
                {hasSystemActivity ? 'Active' : 'Standby'}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-[var(--cf-text-3)] font-medium uppercase tracking-tight">
              {realProviderCount} provider{realProviderCount === 1 ? '' : 's'} connected
            </div>
          </div>
          
          <div className="flex items-end gap-0.5 h-8 border-l border-[var(--cf-border)] pl-4">
            {activityData.map((v, i) => (
              <div 
                key={i} 
                className="w-1.5 bg-[var(--cf-blue)]/40 rounded-t-[2px] transition-all duration-700" 
                style={{ height: `${(v / 12) * 100}%`, opacity: 0.2 + (i / activityData.length) * 0.8 }}
              />
            ))}
          </div>
        </div>

        {/* Middle: Mission/Alert Hub */}
        <div className="cf-panel flex min-w-0 items-center justify-center rounded-[28px] p-5">
          {activeAlert ? (
            <div 
              key={activeAlert.id}
              className={`flex w-full items-center justify-between gap-4 px-4 py-2 rounded-2xl border transition-all animate-in slide-in-from-bottom-2
                ${activeAlert.kind === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 
                  activeAlert.kind === 'success' ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' : 
                  'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 text-sm">
                  {activeAlert.kind === 'error' ? '⚠️' : activeAlert.kind === 'success' ? '✅' : 'ℹ️'}
                </span>
                <div className="truncate">
                  <div className="text-[13px] font-bold leading-tight">{activeAlert.title}</div>
                  {activeAlert.message && (
                    <div className="text-[11px] opacity-70 truncate mt-0.5">{activeAlert.message}</div>
                  )}
                </div>
              </div>
              <button 
                onClick={() => dismissBanner(activeAlert.id)}
                className="shrink-0 rounded-lg bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition hover:bg-white/10"
              >
                Dismiss
              </button>
            </div>
          ) : prioritizedTask ? (
            <div className="flex w-full flex-col px-2">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-[var(--cf-blue)] uppercase tracking-widest">
                    {prioritizedTask.type === 'banner' ? 'Task in progress' : `Processing ${prioritizedTask.tasks.length} Operation${prioritizedTask.tasks.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                <span className="font-mono text-[12px] font-bold text-[var(--cf-text-1)]">{aggregateProgress}%</span>
              </div>
              <div className="h-2 w-full bg-[var(--cf-bg3)] rounded-full overflow-hidden shadow-inner mb-1.5">
                <div 
                  className="h-full bg-[var(--cf-blue)] transition-all duration-700 ease-out shadow-[0_0_12px_rgba(59,130,246,0.4)]"
                  style={{ width: `${aggregateProgress}%` }}
                />
              </div>
              <div className="text-[10px] font-medium text-[var(--cf-text-2)] truncate text-center">
                {operationLabel}
              </div>
            </div>
          ) : (
            <div className="flex w-full items-center gap-6">
              <div className="flex flex-col shrink-0">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--cf-text-3)]">Provider Breakdown</span>
                <span className="mt-1 text-xs font-bold text-[var(--cf-text-1)]">Status Active</span>
              </div>
              <div className="h-8 w-px bg-[var(--cf-border)] shrink-0" />
              <div className="flex-1 flex items-center gap-4 overflow-x-auto no-scrollbar">
                {connections.length > 0 ? connections.map((conn, idx) => {
                  const pct = conn.quota ? Math.round((conn.quota.used / conn.quota.total) * 100) : 0;
                  return (
                    <div key={idx} className="flex flex-col min-w-[80px]">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[9px] font-bold text-[var(--cf-text-2)] truncate max-w-[60px]">{conn.accountLabel || conn.provider}</span>
                        <span className="text-[9px] font-mono font-medium text-[var(--cf-blue)]">{pct}%</span>
                      </div>
                      <div className="h-1 w-full bg-[var(--cf-bg3)] rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--cf-blue)]/60" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-[11px] text-[var(--cf-text-3)] font-medium">
                    Waiting for provider hydration...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Storage Stats */}
        <div className={`cf-panel rounded-[28px] p-5 transition-all duration-500 ${
          quotaPercent >= 95 ? 'ring-1 ring-[var(--cf-red)]/50 bg-[var(--cf-red)]/5' :
          quotaPercent >= 80 ? 'ring-1 ring-[var(--cf-amber)]/50 bg-[var(--cf-amber)]/5' : ''
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--cf-text-2)] block truncate">Total Pooled Storage</span>
                {quotaPercent >= 95 ? (
                  <span className="text-[10px] animate-pulse" title="Critical: Over 95% capacity">🚨</span>
                ) : quotaPercent >= 80 ? (
                  <span className="text-[10px]" title="Warning: Over 80% capacity">⚠️</span>
                ) : null}
              </div>
              <span className="text-[9px] text-[var(--cf-text-3)] block mt-0.5">{transfers.length} jobs tracked</span>
            </div>
            <span className={`text-[11px] font-mono font-bold ${
              quotaPercent >= 95 ? 'text-[var(--cf-red)]' :
              quotaPercent >= 80 ? 'text-[var(--cf-amber)]' :
              'text-[var(--cf-text-1)]'
            }`}>{Math.round(quotaPercent)}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Storage usage"
            aria-valuenow={Math.min(Math.round(quotaPercent), 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 w-full bg-[var(--cf-bg3)] rounded-full overflow-hidden mb-2 shadow-inner"
          >
            <div 
              className={`h-full transition-all duration-1000 ${
                quotaPercent >= 95 ? 'bg-[var(--cf-red)] shadow-[0_0_8px_rgba(255,92,92,0.4)]' :
                quotaPercent >= 80 ? 'bg-[var(--cf-amber)] shadow-[0_0_8px_rgba(255,159,67,0.4)]' :
                'bg-[var(--cf-teal)]'
              }`}
              style={{ width: `${Math.min(quotaPercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono font-medium text-[var(--cf-text-2)]">
            <span className={quotaPercent >= 80 ? 'text-[var(--cf-text-1)]' : ''}>{formatBytes(quotas.used)} used</span>
            <span>{formatBytes(quotas.total)} total</span>
          </div>
          {quotaPercent >= 80 && (
            <div className={`mt-2 py-1 px-2 rounded-lg text-[9px] font-bold uppercase tracking-tight text-center ${
              quotaPercent >= 95 ? 'bg-[var(--cf-red)]/20 text-[var(--cf-red)]' : 'bg-[var(--cf-amber)]/20 text-[var(--cf-amber)]'
            }`}>
              {quotaPercent >= 95 ? 'Critical Storage Limit' : 'Approaching Storage Limit'}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
