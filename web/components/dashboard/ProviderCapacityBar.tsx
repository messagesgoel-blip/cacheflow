'use client'

import { formatBytes } from '@/lib/providers/types'

interface ProviderCapacityBarProps {
  providers: Array<{
    providerId: string
    accountEmail?: string
    displayName?: string
    quota?: { used: number; total: number }
  }>
}

const providerIcons: Record<string, string> = {
  google: 'https://www.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png',
  onedrive: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Microsoft_OneDrive_2019.svg/220px-Microsoft_OneDrive_2019.svg.png',
  dropbox: 'https://www.dropbox.com/static/api/2/dropins-js-api-id.js',
  box: 'https://www.box.com/favicon.ico',
  pcloud: 'https://www.pcloud.com/favicon.ico',
  filen: 'https://filen.io/favicon.ico',
  yandex: 'https://yandex.com/favicon.ico',
  vps: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Virtual_private_server_logo.svg/220px-Virtual_private_server_logo.svg.png',
  webdav: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/WebDAV_logo.svg/220px-WebDAV_logo.svg.png',
  local: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/File_folder_icon.svg/120px-File_folder_icon.svg.png'
}

const providerColors: Record<string, string> = {
  google: 'bg-red-500',
  onedrive: 'bg-blue-500',
  dropbox: 'bg-blue-400',
  box: 'bg-blue-600',
  pcloud: 'bg-orange-500',
  filen: 'bg-purple-500',
  yandex: 'bg-red-600',
  vps: 'bg-gray-600',
  webdav: 'bg-green-600',
  local: 'bg-yellow-500'
}

function getProviderDisplayName(providerId: string, displayName?: string, accountEmail?: string): string {
  if (displayName) return displayName
  if (accountEmail) return accountEmail
  return providerId.charAt(0).toUpperCase() + providerId.slice(1)
}

export default function ProviderCapacityBar({ providers }: ProviderCapacityBarProps) {
  const getThresholdColor = (pct: number, providerId: string) => {
    if (pct >= 95) return 'bg-[var(--cf-red)]'
    if (pct >= 80) return 'bg-[var(--cf-amber)]'
    return providerColors[providerId] || 'bg-blue-500'
  }

  const providersWithQuota = providers.filter(p => p.quota && p.quota.total > 0)
  const providersWithoutQuota = providers.filter(p => !p.quota || p.quota.total === 0)

  if (providers.length === 0) {
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Storage by Provider
      </h3>

      {providersWithQuota.length > 0 && (
        <div className="space-y-4 mb-6">
          {providersWithQuota.map((provider) => {
            const percent = provider.quota!.total > 0
              ? (provider.quota!.used / provider.quota!.total) * 100
              : 0
            const clampedPercent = Math.max(0, Math.min(percent, 100))
            const freeBytes = Math.max(0, provider.quota!.total - provider.quota!.used)
            const isOverQuota = provider.quota!.used > provider.quota!.total
            const colorClass = getThresholdColor(percent, provider.providerId)

            return (
              <div key={`${provider.providerId}:${provider.accountEmail || provider.displayName || 'default'}`} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                      <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {getProviderDisplayName(provider.providerId, provider.displayName, provider.accountEmail)}
                    </span>
                    {percent >= 95 ? (
                      <span className="text-[10px]" title="Critical: Over 95% capacity">🚨</span>
                    ) : percent >= 80 ? (
                      <span className="text-[10px]" title="Warning: Over 80% capacity">⚠️</span>
                    ) : null}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatBytes(provider.quota!.used)} / {formatBytes(provider.quota!.total)}
                  </span>
                </div>
                <div
                  className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(clampedPercent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${getProviderDisplayName(provider.providerId, provider.displayName, provider.accountEmail)} storage usage`}
                >
                  <div
                    className={`h-full transition-all duration-500 ${colorClass}`}
                    style={{ width: `${clampedPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{Math.round(percent)}% used</span>
                  <span>
                    {isOverQuota ? `${formatBytes(provider.quota!.used - provider.quota!.total)} over quota` : `${formatBytes(freeBytes)} free`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {providersWithoutQuota.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
            Providers without storage data
          </h4>
          <div className="flex flex-wrap gap-2">
            {providersWithoutQuota.map((provider) => (
              <span
                key={provider.providerId}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                {getProviderDisplayName(provider.providerId, provider.displayName, provider.accountEmail)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
