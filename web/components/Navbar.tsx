'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
        <span className="text-blue-200 text-sm">{email}</span>
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
