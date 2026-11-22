import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SocialProfileView } from '@/components/social/profile-view'
import { getCurrentSession } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'ملفي الشخصي', description: 'ملفك الشخصي وإعلاناتك ومتابعوك على مَسار.' }

export default async function ProfilePage() {
  const session = await getCurrentSession()
  if (!session?.user) redirect('/sign-in?next=%2Fprofile')
  return <SocialProfileView userId={session.user.id} />
}
