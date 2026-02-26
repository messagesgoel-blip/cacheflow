'use client'

import { useState, useEffect } from 'react'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('cf_theme')
    const hasDark = document.documentElement.classList.contains('dark')
    setIsDark(stored === 'dark' || (!stored && hasDark))
  }, [])

  const toggleTheme = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)

    if (newIsDark) {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
      localStorage.setItem('cf_theme', 'dark')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
      localStorage.setItem('cf_theme', 'light')
    }

    // Force body background change
    document.body.classList.remove('bg-gray-50', 'dark:bg-gray-900')
    document.body.classList.add(newIsDark ? 'dark:bg-gray-900' : 'bg-gray-50')
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label="Toggle dark mode"
      style={{
        padding: '8px',
        borderRadius: '8px',
        backgroundColor: isDark ? '#4b5563' : '#e5e7eb',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isDark ? (
        // Sun icon
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" strokeWidth="2">
          <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        // Moon icon
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
          <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  )
}
