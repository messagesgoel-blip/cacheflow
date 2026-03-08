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
      <div className="cf-micro-label">Navigation Path</div>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 overflow-x-auto whitespace-nowrap font-mono text-[11px] text-[var(--cf-text-2)]">
        <button
          data-testid="cf-breadcrumb-crumb-home"
          onClick={onNavigateHome}
          className="rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-1.5 text-[var(--cf-text-1)] transition-colors hover:border-[rgba(74,158,255,0.24)] hover:text-[var(--cf-blue)]"
        >
          All Files
        </button>

        {selectedProvider !== 'all' && (
          <>
            <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <button
              onClick={() => onNavigateStack(-1)}
              className="rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-1.5 text-[var(--cf-text-0)] transition-colors hover:border-[rgba(74,158,255,0.24)] hover:text-[var(--cf-blue)]"
            >
              {getProviderName()}
            </button>
            {activeAccountName && <span className="cf-chip">{activeAccountName}</span>}
          </>
        )}

        {stack.map((segment, idx) => (
          <div key={`${segment.id}-${idx}`} className="flex min-w-0 items-center gap-2">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <button
              data-testid={`cf-breadcrumb-crumb-${idx}`}
              onClick={() => onNavigateStack(idx)}
              className="max-w-[180px] truncate rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-1.5 transition-colors hover:border-[rgba(74,158,255,0.24)] hover:text-[var(--cf-blue)]"
            >
              {segment.name}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
