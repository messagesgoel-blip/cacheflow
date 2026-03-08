'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import ThemeToggle from './ThemeToggle'

interface NavbarProps {
  email: string
  onLogout: () => void
}

const navItems = [
  { href: '/files', label: 'Files' },
  { href: '/remotes', label: 'Cloud Drives' },
  { href: '/conflicts', label: 'Conflicts' },
  { href: '/admin', label: 'Admin' },
]

export default function Navbar({ email, onLogout }: NavbarProps) {
  const pathname = usePathname()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  return (
    <nav className="bg-blue-700 dark:bg-blue-900 text-white px-6 py-3 flex justify-between items-center shadow">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-bold text-lg tracking-tight">CacheFlow</Link>
        <div className="flex gap-4">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'text-white'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="relative">
          <button
            data-testid="cf-sidebar-user-menu"
            onClick={() => setIsUserMenuOpen(open => !open)}
            className="text-blue-200 text-sm hover:text-white transition-colors"
            type="button"
          >
            {email}
          </button>
          {isUserMenuOpen && (
            <div className="absolute right-0 top-8 min-w-[10rem] rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg py-1 z-20">
              <Link
                data-testid="cf-sidebar-user-settings"
                href="/settings/security"
                className="block px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setIsUserMenuOpen(false)}
              >
                Settings
              </Link>
            </div>
          )}
        </div>
        <button
          onClick={onLogout}
          className="text-sm bg-blue-800 dark:bg-blue-950 px-3 py-1 rounded hover:bg-blue-900"
        >
          Logout
        </button>
      </div>
    </nav>
  )
}

