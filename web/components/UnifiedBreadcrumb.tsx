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
      className="min-w-0"
    >
      <div className="cf-micro-label mb-2">Navigation Path</div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 overflow-x-auto whitespace-nowrap py-1">
        <button
          data-testid="cf-breadcrumb-crumb-home"
          onClick={onNavigateHome}
          className="flex h-8 items-center rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 text-[12px] font-medium text-[var(--cf-text-1)] transition-all hover:border-[rgba(74,158,255,0.3)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-blue)]"
        >
          All Files
        </button>

        {selectedProvider !== 'all' && (
          <>
            <div className="flex items-center text-[var(--cf-text-3)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <button
              onClick={() => onNavigateStack(-1)}
              className="flex h-8 items-center rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 text-[12px] font-semibold text-[var(--cf-text-0)] transition-all hover:border-[rgba(74,158,255,0.3)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-blue)]"
            >
              {getProviderName()}
            </button>
            {activeAccountName && (
              <span className="flex h-6 items-center rounded-full border border-[rgba(74,158,255,0.2)] bg-[rgba(74,158,255,0.06)] px-2.5 text-[10px] font-medium text-[var(--cf-blue)]">
                {activeAccountName}
              </span>
            )}
          </>
        )}

        {stack.map((segment, idx) => (
          <div key={`${segment.id}-${idx}`} className="flex min-w-0 items-center gap-1.5">
            <div className="flex items-center text-[var(--cf-text-3)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <button
              data-testid={`cf-breadcrumb-crumb-${idx}`}
              onClick={() => onNavigateStack(idx)}
              className="flex h-8 max-w-[180px] items-center truncate rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 text-[12px] font-medium text-[var(--cf-text-1)] transition-all hover:border-[rgba(74,158,255,0.3)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
            >
              {segment.name}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
