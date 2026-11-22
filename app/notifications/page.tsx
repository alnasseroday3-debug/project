import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { NotificationsView } from '@/components/social/notifications-view'
import { getCurrentSession } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'الإشعارات', description: 'إشعارات المتابعة والتفاعل على مَسار.' }

export default async function NotificationsPage() {
  const session = await getCurrentSession()
  if (!session?.user) redirect('/sign-in?next=%2Fnotifications')
  return <main className="social-page page-container"><header className="social-page-heading"><span className="eyebrow eyebrow-green">تحديثاتك</span><h1>الإشعارات</h1><p>تابع ما يحدث حول حسابك وإعلاناتك.</p></header><NotificationsView /></main>
}
