'use client'

import { useState, useEffect } from 'react'
import { ProviderId, ProviderQuota, formatBytes } from '@/lib/providers/types'

interface AccountRowProps {
  providerId: ProviderId
  providerName: string
  providerIcon: string
  accountEmail: string
  displayName: string
  accountKey: string
  isActive: boolean
  isCollapsed: boolean
  onClick: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: () => void
  onDrop?: (e: React.DragEvent) => void
}

export default function AccountRow({
  providerId,
  providerName,
  providerIcon,
  accountEmail,
  displayName,
  accountKey,
  isActive,
  isCollapsed,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop
}: AccountRowProps) {
  const [health, setHealth] = useState<{ status: string; message?: string } | null>(null)
  const [quota, setQuota] = useState<ProviderQuota | null>(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    let mounted = true

    const fetchData = async () => {
      try {
        const tokens = JSON.parse(localStorage.getItem(`cacheflow_tokens_${providerId}`) || '[]')
        const token = tokens.find((t: any) => t.accountKey === accountKey)

        if (token?.remoteId && mounted) {
          const res = await fetch(`/api/remotes/${token.remoteId}/health`, {
            credentials: 'include',
          })
          const body = await res.json()
          if (body.ok && mounted) {
            setHealth(body.data)
          }
        }
      } catch (e) {
        // Silently fail - health is optional
      }
    }

    fetchData()

    return () => {
      mounted = false
    }
  }, [providerId, accountKey])

  const getHealthColor = (status?: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500'
      case 'degraded': return 'bg-yellow-500'
      case 'needs_reauth': return 'bg-red-500'
      default: return 'bg-gray-300'
    }
  }

  const getUsagePercent = () => {
    if (!quota) return 0
    return (quota.used / quota.total) * 100
  }

  const getUsageColor = (percent: number) => {
    if (percent > 90) return 'bg-red-500'
    if (percent > 75) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  const baseClasses = `
    flex items-center gap-3 px-3 py-2 rounded-lg transition-all relative w-full
    ${isActive
      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
    }
    ${dragOver ? 'ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-900/50 scale-[1.02] z-10' : ''}
    ${isCollapsed ? 'justify-center px-0' : ''}
  `

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
    onDragOver?.(e)
  }

  const handleDragLeave = () => {
    setDragOver(false)
    onDragLeave?.()
  }

  const handleDrop = (e: React.DragEvent) => {
    setDragOver(false)
    onDrop?.(e)
  }

  const usagePercent = getUsagePercent()

  if (isCollapsed) {
    return (
      <button
        onClick={onClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={baseClasses}
        title={`${displayName}${health?.message ? ` (${health.message})` : ''}`}
      >
        <span className="text-xl">{providerIcon}</span>
        <div
          className={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${getHealthColor(health?.status)}`}
          title={health?.status || 'unknown'}
        />
      </button>
    )
  }

  return (
    <div className="account-row-wrapper group/account">
      <button
        onClick={onClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={baseClasses}
        title={`${displayName}${health?.message ? ` (${health.message})` : ''}`}
      >
        <span className="text-xl">{providerIcon}</span>
        <div className="flex flex-col items-start overflow-hidden flex-1">
          <div className="flex items-center gap-2 w-full">
            <span className="truncate flex-1 text-sm">{displayName}</span>
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${getHealthColor(health?.status)}`}
              title={health?.status || 'unknown'}
            />
          </div>
          <span className="truncate w-full text-[10px] text-gray-400 leading-tight">
            {accountEmail}
          </span>
        </div>
      </button>

      {/* Mini Quota Bar */}
      {quota && (
        <div className="px-10 mt-1 mb-2">
          <div className="h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${getUsageColor(usagePercent)}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[8px] text-gray-400 mt-0.5">
            <span>{formatBytes(quota.used)}</span>
            <span>{Math.round(usagePercent)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

