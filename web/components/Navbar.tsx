'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import CommandPalette from './CommandPalette'
import ThemeToggle from './ThemeToggle'

interface NavbarProps {
  email: string
  onLogout: () => void
}

const navItems = [
  { href: '/files', label: 'Files' },
  { href: '/remotes', label: 'Your Drives' },
  { href: '/conflicts', label: 'Conflicts' },
  { href: '/admin', label: 'Admin' },
]

export default function Navbar({ email, onLogout }: NavbarProps) {
  const pathname = usePathname()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-40 border-b border-[var(--cf-border)] bg-[var(--cf-navbar-bg)] px-5 py-3 backdrop-blur-xl lg:px-6">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4 lg:gap-5">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight text-[var(--cf-text-0)]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--cf-blue)]/40 bg-[rgba(74,158,255,0.12)] text-[11px] font-bold text-[var(--cf-blue)]">
              CF
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] leading-tight">CacheFlow</span>
              <span className="cf-kicker block pt-0.5">Storage Control Plane</span>
            </span>
          </Link>
          <div className="hidden items-center gap-1 rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-1 lg:flex">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium leading-none transition-colors ${
                  pathname === item.href
                    ? 'bg-[rgba(74,158,255,0.14)] text-[var(--cf-blue)]'
                    : 'text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <CommandPalette />
          <div className="hidden rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-1 md:block">
            <ThemeToggle />
          </div>
          <div className="relative">
            <button
              data-testid="cf-sidebar-user-menu"
              onClick={() => setIsUserMenuOpen(open => !open)}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-1.5 text-left transition-colors hover:border-[var(--cf-border-2)]"
              type="button"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(0,201,167,0.14)] text-[10px] font-bold text-[var(--cf-teal)]">
                {email?.slice(0, 2).toUpperCase() || 'CF'}
              </span>
              <span className="hidden min-w-0 md:block">
                <span className="block truncate text-[13px] leading-tight text-[var(--cf-text-0)]">{email}</span>
                <span className="cf-kicker block pt-0.5">Active Session</span>
              </span>
            </button>
            {isUserMenuOpen && (
              <div className="absolute right-0 top-12 z-20 min-w-[12rem] rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-menu-bg)] p-2 shadow-2xl">
                <Link
                  data-testid="cf-sidebar-user-settings"
                  href="/settings/security"
                  className="block rounded-xl px-3 py-2 text-sm text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  Settings
                </Link>
              </div>
            )}
          </div>
          <button
            onClick={onLogout}
            className="rounded-lg border border-[rgba(255,92,92,0.3)] bg-[rgba(255,92,92,0.09)] px-3 py-1.5 text-[13px] font-medium text-[var(--cf-red)] hover:bg-[rgba(255,92,92,0.14)]"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}
