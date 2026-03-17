'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Progress } from '@/components/ui/Progress'
import { Spinner } from '@/components/ui/Spinner'
import { Alert, AlertDescription } from '@/components/ui/Alert'

interface TransferData {
  date: string
  transfer_gb: number
}

export default function TransferChart() {
  const [data, setData] = useState<TransferData[]>([])
  const [loading, setLoading] = useState(true)
  const [todayTransfer, setTodayTransfer] = useState(0)
  const [isMockData, setIsMockData] = useState(false)

  useEffect(() => {
    void fetchTransferStats()
  }, [])

  async function fetchTransferStats() {
    setLoading(true)

    try {
      const res = await fetch('/api/backend/admin/transfer-stats', {
        credentials: 'include',
      })

      if (res.status === 404) {
        generateMockData()
        return
      }

      if (res.status === 403) {
        setIsMockData(true)
        setData([])
        setTodayTransfer(0)
        return
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch transfer stats: ${res.status}`)
      }

      const apiData = await res.json()
      setData(apiData.data || apiData || [])
      calculateTodayTransfer(apiData.data || apiData || [])
    } catch {
      generateMockData()
    } finally {
      setLoading(false)
    }
  }

  function generateMockData() {
    setIsMockData(true)
    const mockData: TransferData[] = []
    const today = new Date()

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const transferGB = Math.random() * 200

      mockData.push({
        date: dateStr,
        transfer_gb: parseFloat(transferGB.toFixed(1))
      })
    }

    setData(mockData)
    calculateTodayTransfer(mockData)
  }

  function calculateTodayTransfer(data: TransferData[]) {
    if (data.length > 0) {
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const todayData = data.find(d => d.date === today)
      setTodayTransfer(todayData?.transfer_gb || data[data.length - 1]?.transfer_gb || 0)
    }
  }

  const todayPercentage = (todayTransfer / 750) * 100

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Daily Transfer (last 7 days)</h3>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Limit: <span className="font-medium">750 GB</span>
        </div>
      </div>

      <div className="h-64 mb-4 relative">
        {isMockData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 z-10">
            <span className="text-4xl font-bold" style={{ color: 'var(--text-muted)', transform: 'rotate(-30deg)' }}>SAMPLE DATA</span>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fill: 'var(--text-secondary)' }} label={{ value: 'GB', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)' }} />
            <Tooltip
              formatter={(value) => [`${value} GB`, 'Transfer']}
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{ 
                backgroundColor: 'var(--bg-surface)', 
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-panel)'
              }}
            />
            <ReferenceLine y={750} stroke="var(--accent-red)" strokeDasharray="3 3" label="Limit" />
            <Bar
              dataKey="transfer_gb"
              fill={todayTransfer > 500 ? 'var(--accent-red)' : 'var(--accent-blue)'}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span style={{ color: 'var(--text-secondary)' }}>Today: {todayTransfer.toFixed(1)} GB / 750 GB</span>
            <span className="font-medium">{todayPercentage.toFixed(1)}%</span>
          </div>
          <Progress value={todayTransfer} max={750} />
        </div>

        {todayTransfer > 500 && (
          <Alert variant="destructive">
            <AlertDescription>
              <span className="font-medium">High usage alert:</span> Today's transfer is above 500 GB. Consider monitoring user activity.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
