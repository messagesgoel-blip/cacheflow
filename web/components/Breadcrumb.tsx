'use client'

export default function Breadcrumb({ path = 'My Files' }: { path?: string }) {
  // Split the path into segments
  const segments = path.split('/').filter(segment => segment.trim() !== '')

  // If no segments or just one segment (filename), show Home > filename
  const displaySegments = segments.length === 0 ? ['My Files'] : segments

  return (
    <div className="text-sm text-gray-500 mb-4">
      <span className="font-medium">Home</span>
      {displaySegments.map((segment, index) => (
        <span key={index}>
          <span className="mx-2">/</span>
          <span className={index === displaySegments.length - 1 ? 'font-medium' : ''}>
            {segment}
          </span>
        </span>
      ))}
    </div>
  )
}