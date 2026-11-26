import type { Metadata } from 'next'
import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { MessagesView } from '@/components/social/messages-view'
import { db } from '@/lib/db'
import { socialConversations, user } from '@/lib/db/schema'
import { getCurrentSession } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'الرسائل الخاصة',
  description: 'مراسلة خاصة مع تشفير تلقائي للرسائل أثناء التخزين.',
}
type PageProps = { searchParams: Promise<{ to?: string }> }

export default async function MessagesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession()
  if (!session?.user) redirect('/sign-in?next=%2Fmessages')

  const { to } = await searchParams
  const targetId = typeof to === 'string' ? to.trim() : ''
  let initialConversationId = ''

  if (targetId && targetId.length <= 128 && targetId !== session.user.id) {
    const [target] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, targetId))
      .limit(1)

    if (target) {
      const [participantOne, participantTwo] = [session.user.id, target.id].sort()

      const [existing] = await db
        .select({ id: socialConversations.id })
        .from(socialConversations)
        .where(
          and(
            eq(socialConversations.participantOne, participantOne),
            eq(socialConversations.participantTwo, participantTwo),
          ),
        )
        .limit(1)

      if (existing) {
        initialConversationId = existing.id
      } else {
        await db
          .insert(socialConversations)
          .values({ participantOne, participantTwo })
          .onConflictDoNothing()

        const [created] = await db
          .select({ id: socialConversations.id })
          .from(socialConversations)
          .where(
            and(
              eq(socialConversations.participantOne, participantOne),
              eq(socialConversations.participantTwo, participantTwo),
            ),
          )
          .limit(1)

        initialConversationId = created?.id ?? ''
      }
    }
  }

  return (
    <main className="social-page page-container">
      <header className="social-page-heading">
        <span className="eyebrow eyebrow-green">تواصل آمن</span>
        <h1>الرسائل</h1>
        <p>محادثات نصية خاصة مشفّرة تلقائياً أثناء التخزين.</p>
      </header>
      <MessagesView userId={session.user.id} initialConversationId={initialConversationId} />
    </main>
  )
}
