'use client'

import { useSearchParams } from 'next/navigation'
import UnifiedFileBrowser from '@/components/UnifiedFileBrowser'

/**
 * Shell component for the files browser that handles client-side routing and parameters.
 * @param {Object} props - Component properties
 * @param {string} props.token - Authentication token for API access
 */
export default function FilesBrowserShell({ token }: { token: string }) {
  const searchParams = useSearchParams()

  // Validate token exists before rendering the browser
  if (!token) {
    return (
      <div className="cf-panel rounded-[28px] px-5 py-8 text-sm text-[var(--cf-text-2)]">
        Authentication required. Please log in to access files.
      </div>
    )
  }

  return <UnifiedFileBrowser token={token} routeView={searchParams.get('view') === 'activity' ? 'activity' : undefined} />
}
