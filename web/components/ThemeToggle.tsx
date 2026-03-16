'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/Button'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cf_theme') === 'dark'
    } catch {
      return false
    }
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const hasDark = document.documentElement.classList.contains('dark')
    try {
      const stored = localStorage.getItem('cf_theme')
      if (stored === 'dark' || (!stored && hasDark)) {
        setIsDark(true)
      }
    } catch {
      // localStorage unavailable
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const newIsDark = !prev

      document.documentElement.classList.remove('dark', 'light')
      if (newIsDark) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('cf_theme', 'dark')
      } else {
        document.documentElement.classList.add('light')
        localStorage.setItem('cf_theme', 'light')
      }

      return newIsDark
    })
  }, [])

  // Keyboard shortcut: Ctrl/Cmd + Shift + D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        toggleTheme()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleTheme])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle dark mode"
        style={{
          width: '40px',
          height: '40px',
        }}
      />
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title="Toggle dark mode (Ctrl+Shift+D)"
      style={{
        width: '40px',
        height: '40px',
      }}
    >
      <div style={{ position: 'relative', width: '20px', height: '20px' }}>
        {/* Sun Icon */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isDark ? 0 : 1,
            transform: isDark ? 'rotate(90deg) scale(0)' : 'rotate(0) scale(1)',
            transition: 'all var(--transition-base)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        </div>

        {/* Moon Icon */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isDark ? 1 : 0,
            transform: isDark ? 'rotate(0) scale(1)' : 'rotate(-90deg) scale(0)',
            transition: 'all var(--transition-base)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </div>
      </div>
    </Button>
  )
}
