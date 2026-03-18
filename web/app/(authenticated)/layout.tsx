import { redirect } from 'next/navigation'
import { resolveServerSession } from '@/lib/auth/serverSession'
import { AppShell } from '@/components/shell/AppShell'

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await resolveServerSession()

  if (!session.authenticated) {
    redirect('/login')
  }

  return (
    <AppShell>
      {children}
    </AppShell>
  )
}
