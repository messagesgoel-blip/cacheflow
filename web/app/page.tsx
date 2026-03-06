import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import HomeEntry from '@/components/HomeEntry'

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>
}) {
  const cookieStore = await cookies()
  const hasSession = Boolean(
    cookieStore.get('accessToken')?.value || cookieStore.get('userData')?.value,
  )

  if (hasSession) {
    redirect('/files')
  }

  const params = searchParams ? await searchParams : undefined
  const mode = params?.mode === 'register' ? 'register' : 'login'

  return <HomeEntry initialMode={mode} />
}
