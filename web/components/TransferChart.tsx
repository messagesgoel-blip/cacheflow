'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8100'

interface TransferData {
  date: string
  transfer_gb: number
}

interface TransferChartProps {
  token: string
}

export default function TransferChart({ token }: TransferChartProps) {
  const [data, setData] = useState<TransferData[]>([])
  const [loading, setLoading] = useState(true)
  const [todayTransfer, setTodayTransfer] = useState(0)
  const [isMockData, setIsMockData] = useState(false)

  useEffect(() => {
    fetchTransferStats()
  }, [token])

  async function fetchTransferStats() {
    setLoading(true)

    try {
      const res = await fetch(`${API}/admin/transfer-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.status === 404) {
        // Use mock data if API not implemented
        generateMockData()
        return
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch transfer stats: ${res.status}`)
      }

      const apiData = await res.json()
      setData(apiData.data || apiData || [])
      calculateTodayTransfer(apiData.data || apiData || [])
    } catch (err) {
      console.error('Failed to load transfer stats:', err)
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
      const transferGB = Math.random() * 200 // Random value between 0-200 GB

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">Daily Transfer (last 7 days)</h3>
        <div className="text-sm text-gray-500">
          Limit: <span className="font-medium">750 GB</span>
        </div>
      </div>

      <div className="h-64 mb-4 relative">
        {isMockData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 z-10">
            <span className="text-4xl font-bold text-gray-500 -rotate-[30deg]">SAMPLE DATA</span>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="date" />
            <YAxis label={{ value: 'GB', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              formatter={(value) => [`${value} GB`, 'Transfer']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <ReferenceLine y={750} stroke="red" strokeDasharray="3 3" label="Limit" />
            <Bar
              dataKey="transfer_gb"
              fill={todayTransfer > 500 ? '#ef4444' : '#3b82f6'}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Today: {todayTransfer.toFixed(1)} GB / 750 GB</span>
            <span className="font-medium">{todayPercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${todayPercentage > 90 ? 'bg-red-500' : todayPercentage > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(todayPercentage, 100)}%` }}
            ></div>
          </div>
        </div>

        {todayTransfer > 500 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm">
            <span className="font-medium text-red-700">High usage alert:</span> Today's transfer is above 500 GB. Consider monitoring user activity.
          </div>
        )}
      </div>
    </div>
  )
}