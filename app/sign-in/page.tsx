import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth/auth-form'
import { getCurrentSession } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

type SignInPageProps = {
  searchParams: Promise<{ next?: string }>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await getCurrentSession()
  if (session?.user) redirect('/')
  const params = await searchParams
  return <AuthForm mode="sign-in" redirectTo={params.next} />
}
