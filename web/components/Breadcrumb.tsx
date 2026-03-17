'use client'

import { Button } from '@/components/ui/Button'

interface BreadcrumbProps {
  path?: string
  onSegmentClick?: (path: string) => void
}

export default function Breadcrumb({ path = '/', onSegmentClick }: BreadcrumbProps) {
  // Split the path into segments
  const segments = path === '/' ? [] : path.split('/').filter(segment => segment.trim() !== '')

  // Build clickable segments
  const breadcrumbSegments = [
    { name: 'Home', path: '/' }
  ]

  let currentPath = ''
  segments.forEach((segment, index) => {
    currentPath += (currentPath === '' ? '' : '/') + segment
    breadcrumbSegments.push({
      name: segment,
      path: '/' + currentPath
    })
  })

  const handleClick = (segmentPath: string) => {
    if (onSegmentClick && segmentPath !== path) {
      onSegmentClick(segmentPath)
    }
  }

  return (
    <div className="text-sm mb-4 flex items-center flex-wrap" style={{ color: 'var(--text-secondary)' }}>
      {breadcrumbSegments.map((segment, index) => {
        const isLast = index === breadcrumbSegments.length - 1
        const isClickable = onSegmentClick && !isLast

        return (
          <div key={index} className="flex items-center">
            {index > 0 && <span className="mx-2">/</span>}
            {isClickable ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleClick(segment.path)}
                className="h-auto p-0 text-sm"
                style={{ color: 'var(--accent-blue)' }}
              >
                {segment.name}
              </Button>
            ) : (
              <span style={{ 
                color: isLast ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isLast ? 500 : 400
              }}>
                {segment.name}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
