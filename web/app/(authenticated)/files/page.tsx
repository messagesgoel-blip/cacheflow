import { Suspense } from 'react'
import FilesBrowserShell from './FilesBrowserShell'
import MissionControl from '@/components/MissionControl'
import { getServerSession } from '@/lib/auth/serverSession'
import { redirect } from 'next/navigation'

export default async function FilesPage() {
  const session = await getServerSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <div>
      <main className="mx-auto max-w-[1600px] p-4 md:p-6">
        <MissionControl />
        <Suspense
          fallback={
            <div className="cf-panel rounded-[28px] px-5 py-8 text-sm text-[var(--cf-text-2)]">
              Loading files workspace…
            </div>
          }
        >
          <FilesBrowserShell token={session.accessToken || ""} />
        </Suspense>
      </main>
    </div>
  )
}
