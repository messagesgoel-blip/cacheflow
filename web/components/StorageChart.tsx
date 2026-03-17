'use client'

import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Spinner } from '@/components/ui/Spinner'

interface StorageData {
  name: string
  value: number
  color: string
}

export default function StorageChart() {
  const [data, setData] = useState<StorageData[]>([])
  const [loading, setLoading] = useState(true)
  const [totalGB, setTotalGB] = useState(0)

  const getPercent = (value: number) => totalGB > 0 ? ((value / totalGB) * 100).toFixed(1) + '%' : '0%'

  const percentages = data.reduce((acc, item) => {
    acc[item.name] = totalGB > 0 ? ((item.value / totalGB) * 100).toFixed(1) : '0.0'
    return acc
  }, {} as Record<string, string>)

  useEffect(() => {
    void fetchStorageBreakdown()
  }, [])

  async function fetchStorageBreakdown() {
    setLoading(true)

    try {
      const res = await fetch('/api/backend/admin/storage-breakdown', {
        credentials: 'include',
      })

      if (res.status === 404 || res.status === 403) {
        generateMockData()
        return
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch storage breakdown: ${res.status}`)
      }

      const apiData = await res.json()
      processApiData(apiData)
    } catch {
      generateMockData()
    } finally {
      setLoading(false)
    }
  }

  function processApiData(apiData: any) {
    const processedData: StorageData[] = []
    let total = 0

    if (apiData.synced !== undefined) {
      processedData.push({ name: 'Synced', value: apiData.synced, color: 'var(--accent-teal)' })
      total += apiData.synced
    }

    if (apiData.pending !== undefined) {
      processedData.push({ name: 'Pending', value: apiData.pending, color: 'var(--accent-amber)' })
      total += apiData.pending
    }

    if (apiData.error !== undefined) {
      processedData.push({ name: 'Error', value: apiData.error, color: 'var(--accent-red)' })
      total += apiData.error
    }

    setData(processedData)
    setTotalGB(total)
  }

  function generateMockData() {
    const mockData: StorageData[] = [
      { name: 'Synced', value: 45, color: 'var(--accent-teal)' },
      { name: 'Pending', value: 5, color: 'var(--accent-amber)' },
      { name: 'Error', value: 2, color: 'var(--accent-red)' }
    ]

    setData(mockData)
    setTotalGB(52)
  }

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
        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Storage by Status</h3>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Total: <span className="font-medium">{totalGB.toFixed(1)} GB</span>
        </div>
      </div>

      <div className="h-64 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name }) => `${name}: ${percentages[name] || '0.0'}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [`${value} GB`, 'Storage']}
              contentStyle={{ 
                backgroundColor: 'var(--bg-surface)', 
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-panel)'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              ></div>
              <span style={{ color: 'var(--text-primary)' }}>{item.name}</span>
            </div>
            <span style={{ color: 'var(--text-secondary)' }}>
              {item.value.toFixed(1)} GB ({percentages[item.name] || '0.0'}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
