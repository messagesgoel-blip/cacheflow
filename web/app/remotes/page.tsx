'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import RemotesPanel from '@/components/RemotesPanel'

export default function RemotesPage() {
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const router = useRouter()

  useEffect(() => {
    const t = localStorage.getItem('cf_token')
    const e = localStorage.getItem('cf_email')
    if (!t || !e) {
      router.push('/login')
    } else {
      setToken(t)
      setEmail(e)
    }
  }, [router])

  function handleLogout() {
    localStorage.removeItem('cf_token')
    localStorage.removeItem('cf_email')
    router.push('/login')
  }

  if (!token) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar email={email} onLogout={handleLogout} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <RemotesPanel token={token} />
      </main>
    </div>
  )
}
