'use client'

import { useSearchParams } from 'next/navigation'
import UnifiedFileBrowser from '@/components/UnifiedFileBrowser'

export default function FilesBrowserShell({ token }: { token: string }) {
  const searchParams = useSearchParams()

  return <UnifiedFileBrowser token={token} routeView={searchParams.get('view') === 'activity' ? 'activity' : undefined} />
}
