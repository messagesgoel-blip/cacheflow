import { redirect } from 'next/navigation'
import HomeEntry from '@/components/HomeEntry'
import { resolveServerSession } from '@/lib/auth/serverSession'

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>
}) {
  const session = await resolveServerSession()
  if (session.authenticated) {
    redirect('/files')
  }

  const params = searchParams ? await searchParams : undefined
  const mode = params?.mode === 'register' ? 'register' : 'login'

  return <HomeEntry initialMode={mode} />
}

