'use client'

import { ProviderId, PROVIDERS } from '@/lib/providers/types'

interface BreadcrumbProps {
  selectedProvider: ProviderId | 'all' | 'recent' | 'starred' | 'activity'
  activeAccountName?: string
  stack: Array<{ id: string; name: string }>
  onNavigateStack: (idx: number) => void
  onNavigateHome: () => void
}

export default function UnifiedBreadcrumb({
  selectedProvider,
  activeAccountName,
  stack,
  onNavigateStack,
  onNavigateHome,
}: BreadcrumbProps) {
  
  const getProviderName = () => {
    if (selectedProvider === 'all') return 'All Files'
    if (selectedProvider === 'recent') return 'Recent'
    if (selectedProvider === 'starred') return 'Starred'
    if (selectedProvider === 'activity') return 'Activity Feed'
    return PROVIDERS.find(p => p.id === selectedProvider)?.name || selectedProvider
  }

  return (
    <div 
      data-testid="cf-breadcrumb"
      className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 overflow-x-auto whitespace-nowrap pb-1"
    >
      <button
        data-testid="cf-breadcrumb-crumb-home"
        onClick={onNavigateHome}
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        All Files
      </button>

      {selectedProvider !== 'all' && (
        <>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <button
            onClick={() => onNavigateStack(-1)}
            className="font-medium text-gray-900 dark:text-white hover:text-blue-600 transition-colors"
          >
            {getProviderName()}
            {activeAccountName && ` (${activeAccountName})`}
          </button>
        </>
      )}

      {stack.map((segment, idx) => (
        <div key={`${segment.id}-${idx}`} className="flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <button
            data-testid={`cf-breadcrumb-crumb-${idx}`}
            onClick={() => onNavigateStack(idx)}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors max-w-[150px] truncate"
          >
            {segment.name}
          </button>
        </div>
      ))}
    </div>
  )
}

