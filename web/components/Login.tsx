'use client'
import { useState } from 'react'
import { login, register } from '@/lib/api'

export default function Login({
  onLogin,
  initialMode = 'login',
}: {
  onLogin: (token: string, email: string) => void
  initialMode?: 'login' | 'register'
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const action = mode === 'login' ? login : register
      const data = await action(email, password)
      if (data.token) {
        onLogin(data.token, data?.user?.email || email)
      } else {
        setError(data.error || (mode === 'login' ? 'Login failed' : 'Registration failed'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-blue-700 mb-2">CacheFlow</h1>
        <p className="text-gray-500 mb-6">Hybrid Cloud Storage</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            type="submit" disabled={loading}>
            {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign In' : 'Register')}
          </button>
          <button
            className="w-full border border-blue-200 text-blue-700 py-2 rounded-lg hover:bg-blue-50 disabled:opacity-50"
            type="button"
            disabled={loading}
            onClick={() => {
              setError('')
              setMode(mode === 'login' ? 'register' : 'login')
            }}
          >
            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
