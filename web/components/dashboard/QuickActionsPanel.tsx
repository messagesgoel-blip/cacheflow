'use client'

import Link from 'next/link'

type QuickAction = {
  id: string
  label: string
  description: string
  href: string
  icon: string
  accentClass: string
}

const quickActions: QuickAction[] = [
  {
    id: 'files',
    label: 'Open Files',
    description: 'Jump into the main browser workspace and manage provider content.',
    href: '/files',
    icon: '↗',
    accentClass: 'border-[rgba(74,158,255,0.24)] bg-[rgba(74,158,255,0.1)] text-[var(--cf-blue)]',
  },
  {
    id: 'providers',
    label: 'Connect Provider',
    description: 'Review existing connections or add a new cloud or VPS endpoint.',
    href: '/providers',
    icon: '+',
    accentClass: 'border-[rgba(0,201,167,0.24)] bg-[rgba(0,201,167,0.1)] text-[var(--cf-teal)]',
  },
  {
    id: 'schedules',
    label: 'Review Schedules',
    description: 'Check recurring transfer plans already available in the current control plane.',
    href: '/schedules',
    icon: '⏱',
    accentClass: 'border-[rgba(255,159,67,0.24)] bg-[rgba(255,159,67,0.1)] text-[var(--cf-amber)]',
  },
  {
    id: 'security',
    label: 'Security Settings',
    description: 'Open the current 2FA and account-protection surfaces.',
    href: '/settings/security',
    icon: '✓',
    accentClass: 'border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] text-[var(--cf-text-1)]',
  },
]

export default function QuickActionsPanel() {
  return (
    <section data-testid="cf-dashboard-quick-actions" className="cf-panel rounded-[28px] p-5">
      <div className="mb-4">
        <div className="cf-kicker mb-2">Quick Actions</div>
        <h2 className="text-lg font-semibold text-[var(--cf-text-0)]">Common jumps for the active control plane session.</h2>
        <p className="mt-1.5 text-sm text-[var(--cf-text-1)]">
          Fast access to real CacheFlow routes without introducing new product surfaces.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {quickActions.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            data-testid={`cf-dashboard-quick-action-${action.id}`}
            className="group flex items-start gap-3 rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-4 transition hover:border-[rgba(255,255,255,0.14)] hover:bg-[rgba(255,255,255,0.05)]"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${action.accentClass}`}
              aria-hidden="true"
            >
              {action.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--cf-text-0)]">{action.label}</span>
                <span className="text-[12px] text-[var(--cf-text-3)] transition group-hover:text-[var(--cf-text-1)]">Open</span>
              </span>
              <span className="mt-1 block text-[12px] leading-5 text-[var(--cf-text-2)]">
                {action.description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
