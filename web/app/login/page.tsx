import { redirect } from 'next/navigation'

export default function LoginPage() {
  redirect('/?mode=login')
}
