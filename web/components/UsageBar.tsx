'use client'

import { Progress } from '@/components/ui/Progress'
import { Card, CardContent } from '@/components/ui/Card'

export default function UsageBar({ usage }: { usage: any }) {
  if (!usage) return null

  const pct = Math.min(usage.used_pct || 0, 100)
  const usedGB = (usage.used_bytes / 1073741824).toFixed(2)
  const totalGB = (usage.quota_bytes / 1073741824).toFixed(0)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between text-sm mb-2">
          <span style={{ color: 'var(--text-secondary)' }}>Storage Used</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {usedGB} GB / {totalGB} GB ({pct}%)
          </span>
        </div>
        <Progress value={usage.used_bytes} max={usage.quota_bytes} />
        {usage.files && (
          <div className="flex gap-4 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            {Object.entries(usage.files).map(([status, info]: [string, any]) => (
              <span key={status} className="capitalize">{status}: {info.count}</span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
