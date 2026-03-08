import { redirect } from 'next/navigation'

export default function AuthRegisterPage() {
  redirect('/?mode=register')
}

