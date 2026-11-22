import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SettingsPanel } from '@/components/marketplace/settings-panel'
import { getCurrentSession } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'الإعدادات',
  description: 'إعدادات حسابك ومظهر منصة مَسار وتفضيلات الإعلانات.',
}

export default async function SettingsPage() {
  const session = await getCurrentSession()
  if (!session?.user) redirect('/sign-in?next=%2Fsettings')

  return (
    <main className="settings-page page-container">
      <header className="settings-page-heading">
        <span className="eyebrow eyebrow-green">حسابك في مَسار</span>
        <h1>الإعدادات</h1>
        <p>خصّص تجربة التصفح والإعلانات بما يناسبك.</p>
      </header>
      <SettingsPanel user={session.user} />
    </main>
  )
}
