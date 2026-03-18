import { Suspense } from 'react'
import FilesBrowserShell from './FilesBrowserShell'
import MissionControl from '@/components/MissionControl'

export default function FilesPage() {
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
          <FilesBrowserShell token="" />
        </Suspense>
      </main>
    </div>
  )
}
