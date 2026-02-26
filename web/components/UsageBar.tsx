'use client'
export default function UsageBar({ usage }: { usage: any }) {
  if (!usage) return null
  const pct = Math.min(usage.used_pct || 0, 100)
  const usedGB = (usage.used_bytes / 1073741824).toFixed(2)
  const totalGB = (usage.quota_bytes / 1073741824).toFixed(0)
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-1">
        <span>Storage Used</span>
        <span>{usedGB} GB / {totalGB} GB ({pct}%)</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      {usage.files && (
        <div className="flex gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
          {Object.entries(usage.files).map(([status, info]: [string, any]) => (
            <span key={status} className="capitalize">{status}: {info.count}</span>
          ))}
        </div>
      )}
    </div>
  )
}
