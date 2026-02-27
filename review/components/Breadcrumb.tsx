'use client'

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
    <div className="text-sm text-gray-500 mb-4 flex items-center flex-wrap">
      {breadcrumbSegments.map((segment, index) => {
        const isLast = index === breadcrumbSegments.length - 1
        const isClickable = onSegmentClick && !isLast

        return (
          <div key={index} className="flex items-center">
            {index > 0 && <span className="mx-2">/</span>}
            {isClickable ? (
              <button
                onClick={() => handleClick(segment.path)}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {segment.name}
              </button>
            ) : (
              <span className={isLast ? 'font-medium text-gray-700' : ''}>
                {segment.name}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}