import { and, desc, eq, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { socialConversations, user } from '@/lib/db/schema'
import { jsonError, optionalSocialUser, requireSocialUser, socialRateLimited, validId } from '@/lib/social/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const viewer = await optionalSocialUser()
  if (!viewer) return jsonError('سجّل الدخول للمتابعة.', 401)
  const first = alias(user, 'conversation_participant_one')
  const second = alias(user, 'conversation_participant_two')
  const conversations = await db.select({
    id: socialConversations.id,
    updatedAt: socialConversations.updatedAt,
    participantOne: socialConversations.participantOne,
    participantTwo: socialConversations.participantTwo,
    firstName: first.name,
    firstImage: first.image,
    firstKey: first.messagingPublicKey,
    secondName: second.name,
    secondImage: second.image,
    secondKey: second.messagingPublicKey,
  }).from(socialConversations)
    .innerJoin(first, eq(first.id, socialConversations.participantOne))
    .innerJoin(second, eq(second.id, socialConversations.participantTwo))
    .where(or(eq(socialConversations.participantOne, viewer.id), eq(socialConversations.participantTwo, viewer.id)))
    .orderBy(desc(socialConversations.updatedAt)).limit(50)
  return NextResponse.json({ conversations: conversations.map((item) => {
    const isFirst = item.participantOne === viewer.id
    return {
      id: item.id,
      updatedAt: item.updatedAt,
      other: {
        id: isFirst ? item.participantTwo : item.participantOne,
        name: isFirst ? item.secondName : item.firstName,
        image: isFirst ? item.secondImage : item.firstImage,
        messagingPublicKey: isFirst ? item.secondKey : item.firstKey,
      },
    }
  }) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const { user: actor, response } = await requireSocialUser(request)
  if (response || !actor) return response
  if (await socialRateLimited('conversation-create', actor.id, 20)) return jsonError('تم تجاوز عدد المحاولات. حاول لاحقاً.', 429)
  const body = await request.json().catch(() => null) as { targetId?: unknown } | null
  const targetId = body?.targetId
  if (!validId(targetId) || targetId === actor.id) return jsonError('المستخدم غير صالح.', 400)
  const [target] = await db.select({ id: user.id, messagingPublicKey: user.messagingPublicKey }).from(user).where(eq(user.id, targetId)).limit(1)
  const [sender] = await db.select({ messagingPublicKey: user.messagingPublicKey }).from(user).where(eq(user.id, actor.id)).limit(1)
  if (!target) return jsonError('المستخدم غير موجود.', 404)
  if (!target.messagingPublicKey || !sender?.messagingPublicKey) return jsonError('يجب تفعيل التشفير الآمن لدى الطرفين قبل بدء المحادثة.', 409)
  const [participantOne, participantTwo] = [actor.id, targetId].sort()
  await db.insert(socialConversations).values({ participantOne, participantTwo }).onConflictDoNothing()
  const [conversation] = await db.select({ id: socialConversations.id }).from(socialConversations)
    .where(and(eq(socialConversations.participantOne, participantOne), eq(socialConversations.participantTwo, participantTwo))).limit(1)
  if (!conversation) return jsonError('تعذّر بدء المحادثة.', 500)
  return NextResponse.json({ id: conversation.id }, { headers: { 'Cache-Control': 'no-store' } })
}
