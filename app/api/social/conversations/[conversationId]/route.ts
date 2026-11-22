import { and, desc, eq, or, sql } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { socialConversations, socialMessages, user } from '@/lib/db/schema'
import { jsonError, requireSocialUser, socialRateLimited, validBase64, validId } from '@/lib/social/api'

export const dynamic = 'force-dynamic'
type RouteProps = { params: Promise<{ conversationId: string }> }

async function getConversation(conversationId: string, userId: string) {
  const [conversation] = await db.select({ id: socialConversations.id, participantOne: socialConversations.participantOne, participantTwo: socialConversations.participantTwo })
    .from(socialConversations).where(and(eq(socialConversations.id, conversationId), or(eq(socialConversations.participantOne, userId), eq(socialConversations.participantTwo, userId)))).limit(1)
  return conversation
}

export async function GET(request: NextRequest, { params }: RouteProps) {
  const { user: viewer } = await requireSocialUser(request)
  if (!viewer) return jsonError('سجّل الدخول للمتابعة.', 401)
  const { conversationId } = await params
  if (!validId(conversationId)) return jsonError('المحادثة غير موجودة.', 404)
  const conversation = await getConversation(conversationId, viewer.id)
  if (!conversation) return jsonError('المحادثة غير موجودة.', 404)
  const otherId = conversation.participantOne === viewer.id ? conversation.participantTwo : conversation.participantOne
  const [other] = await db.select({ id: user.id, name: user.name, image: user.image, messagingPublicKey: user.messagingPublicKey }).from(user).where(eq(user.id, otherId)).limit(1)
  const records = await db.select({ id: socialMessages.id, senderId: socialMessages.senderId, ciphertext: socialMessages.ciphertext, iv: socialMessages.iv, senderWrappedKey: socialMessages.senderWrappedKey, recipientWrappedKey: socialMessages.recipientWrappedKey, createdAt: socialMessages.createdAt })
    .from(socialMessages).where(eq(socialMessages.conversationId, conversationId)).orderBy(desc(socialMessages.createdAt)).limit(200)
  const messages = records.reverse().map((message) => ({ id: message.id, senderId: message.senderId, ciphertext: message.ciphertext, iv: message.iv, wrappedKey: message.senderId === viewer.id ? message.senderWrappedKey : message.recipientWrappedKey, createdAt: message.createdAt }))
  return NextResponse.json({ other, messages }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  const { user: actor, response } = await requireSocialUser(request)
  if (response || !actor) return response
  if (await socialRateLimited('message-send', actor.id, 60)) return jsonError('تم تجاوز عدد المحاولات. حاول لاحقاً.', 429)
  const { conversationId } = await params
  if (!validId(conversationId)) return jsonError('المحادثة غير موجودة.', 404)
  const conversation = await getConversation(conversationId, actor.id)
  if (!conversation) return jsonError('المحادثة غير موجودة.', 404)
  const body = await request.json().catch(() => null) as { ciphertext?: unknown; iv?: unknown; senderWrappedKey?: unknown; recipientWrappedKey?: unknown } | null
  if (!body || !validBase64(body.ciphertext, 20_000) || !validBase64(body.iv, 64) || !validBase64(body.senderWrappedKey, 2048) || !validBase64(body.recipientWrappedKey, 2048)) {
    return jsonError('صيغة الرسالة المشفّرة غير صالحة.', 400)
  }
  const recipientId = conversation.participantOne === actor.id ? conversation.participantTwo : conversation.participantOne
  const timestamp = new Date()
  const message = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${conversationId}))`)
    await tx.delete(socialMessages).where(and(eq(socialMessages.conversationId, conversationId), sql`${socialMessages.createdAt} < ${new Date(timestamp.getTime() - 7 * 24 * 60 * 60 * 1000)}`))
    const [inserted] = await tx.insert(socialMessages).values({ conversationId, senderId: actor.id, recipientId, ciphertext: body.ciphertext as string, iv: body.iv as string, senderWrappedKey: body.senderWrappedKey as string, recipientWrappedKey: body.recipientWrappedKey as string, createdAt: timestamp }).returning({ id: socialMessages.id, createdAt: socialMessages.createdAt })
    await tx.execute(sql`
      DELETE FROM social_messages
      WHERE id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (ORDER BY created_at DESC, id DESC) AS position
          FROM social_messages WHERE conversation_id = ${conversationId}::uuid
        ) ranked WHERE ranked.position > 200
      )
    `)
    await tx.update(socialConversations).set({ updatedAt: timestamp }).where(eq(socialConversations.id, conversationId))
    return inserted
  })
  return NextResponse.json({ message: { ...message, senderId: actor.id, ciphertext: body.ciphertext, iv: body.iv, wrappedKey: body.senderWrappedKey } }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
