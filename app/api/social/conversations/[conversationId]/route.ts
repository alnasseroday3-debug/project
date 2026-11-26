import crypto from 'node:crypto'
import { and, desc, eq, or, sql } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { socialConversations, socialMessages, user } from '@/lib/db/schema'
import { jsonError, requireSocialUser, socialRateLimited, validId } from '@/lib/social/api'

export const dynamic = 'force-dynamic'
type RouteProps = { params: Promise<{ conversationId: string }> }

function getStorageKey(conversationId: string) {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.DATABASE_URL || 'masar-syria-storage-secret-v1'
  return crypto.createHash('sha256').update(`${secret}:${conversationId}`).digest()
}

function encryptAtRest(plaintext: string, conversationId: string) {
  const key = getStorageKey(conversationId)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  const payload = Buffer.concat([encrypted, authTag]).toString('base64')
  return {
    ciphertext: payload,
    iv: iv.toString('base64'),
    wrappedKey: 'server-aes-256-gcm',
  }
}

function decryptAtRest(ciphertext: string, ivBase64: string, wrappedKey: string, conversationId: string): string | null {
  if (wrappedKey !== 'server-aes-256-gcm') return null
  try {
    const key = getStorageKey(conversationId)
    const iv = Buffer.from(ivBase64, 'base64')
    const raw = Buffer.from(ciphertext, 'base64')
    const authTag = raw.subarray(raw.length - 16)
    const encrypted = raw.subarray(0, raw.length - 16)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

async function getConversation(conversationId: string, userId: string) {
  const [conversation] = await db
    .select({
      id: socialConversations.id,
      participantOne: socialConversations.participantOne,
      participantTwo: socialConversations.participantTwo,
    })
    .from(socialConversations)
    .where(
      and(
        eq(socialConversations.id, conversationId),
        or(eq(socialConversations.participantOne, userId), eq(socialConversations.participantTwo, userId)),
      ),
    )
    .limit(1)
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
  const [other] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(eq(user.id, otherId))
    .limit(1)
  const records = await db
    .select({
      id: socialMessages.id,
      senderId: socialMessages.senderId,
      ciphertext: socialMessages.ciphertext,
      iv: socialMessages.iv,
      senderWrappedKey: socialMessages.senderWrappedKey,
      recipientWrappedKey: socialMessages.recipientWrappedKey,
      createdAt: socialMessages.createdAt,
    })
    .from(socialMessages)
    .where(eq(socialMessages.conversationId, conversationId))
    .orderBy(desc(socialMessages.createdAt))
    .limit(200)

  const messages = records.reverse().map((message) => {
    const wrappedKey = message.senderId === viewer.id ? message.senderWrappedKey : message.recipientWrappedKey
    const decryptedText = decryptAtRest(message.ciphertext, message.iv, wrappedKey, conversationId)
    return {
      id: message.id,
      senderId: message.senderId,
      text: decryptedText ?? 'رسالة قديمة مشفّرة بمفتاح جهاز سابق.',
      createdAt: message.createdAt,
    }
  })

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

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text || text.length > 2000) {
    return jsonError('يرجى كتابة رسالة نصية صالحة (بحد أقصى 2000 حرف).', 400)
  }

  const encrypted = encryptAtRest(text, conversationId)
  const recipientId = conversation.participantOne === actor.id ? conversation.participantTwo : conversation.participantOne
  const timestamp = new Date()

  const message = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${conversationId}))`)
    await tx
      .delete(socialMessages)
      .where(
        and(
          eq(socialMessages.conversationId, conversationId),
          sql`${socialMessages.createdAt} < ${new Date(timestamp.getTime() - 7 * 24 * 60 * 60 * 1000)}`,
        ),
      )
    const [inserted] = await tx
      .insert(socialMessages)
      .values({
        conversationId,
        senderId: actor.id,
        recipientId,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        senderWrappedKey: encrypted.wrappedKey,
        recipientWrappedKey: encrypted.wrappedKey,
        createdAt: timestamp,
      })
      .returning({ id: socialMessages.id, createdAt: socialMessages.createdAt })

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

  return NextResponse.json(
    { message: { ...message, senderId: actor.id, text } },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  )
           }
