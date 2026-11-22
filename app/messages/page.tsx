import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MessagesView } from '@/components/social/messages-view'
import { getCurrentSession } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'الرسائل الخاصة', description: 'محادثات نصية خاصة ومشفّرة بين أعضاء مَسار.' }
type PageProps = { searchParams: Promise<{ to?: string }> }

export default async function MessagesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession()
  if (!session?.user) redirect('/sign-in?next=%2Fmessages')
  const { to } = await searchParams
  return <main className="social-page page-container"><header className="social-page-heading"><span className="eyebrow eyebrow-green">تواصل آمن</span><h1>الرسائل</h1><p>محادثات نصية خاصة لا يستطيع الخادم فك تشفيرها.</p></header><MessagesView userId={session.user.id} targetId={to ?? ''} /></main>
}
