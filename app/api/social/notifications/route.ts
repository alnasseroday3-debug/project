import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { socialNotifications, user } from '@/lib/db/schema'
import { jsonError, optionalSocialUser, requireSocialUser, socialRateLimited, validId } from '@/lib/social/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const viewer = await optionalSocialUser()
  if (!viewer) return jsonError('سجّل الدخول للمتابعة.', 401)
  const notifications = await db.select({ id: socialNotifications.id, actorId: socialNotifications.actorId, actorName: user.name, actorImage: user.image, type: socialNotifications.notificationType, entityId: socialNotifications.entityId, createdAt: socialNotifications.createdAt, readAt: socialNotifications.readAt, isFollowing: sql<boolean>`EXISTS (SELECT 1 FROM user_follows f WHERE f.follower_id = ${viewer.id} AND f.followed_id = ${user.id})` })
    .from(socialNotifications).innerJoin(user, eq(user.id, socialNotifications.actorId))
    .where(eq(socialNotifications.recipientId, viewer.id)).orderBy(desc(socialNotifications.createdAt)).limit(50)
  const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(socialNotifications)
    .where(and(eq(socialNotifications.recipientId, viewer.id), isNull(socialNotifications.readAt)))
  return NextResponse.json({ notifications, unreadCount: count?.total ?? 0 }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest) {
  const { user: viewer, response } = await requireSocialUser(request)
  if (response || !viewer) return response
  if (await socialRateLimited('notification-read', viewer.id, 100)) return jsonError('تم تجاوز عدد المحاولات. حاول لاحقاً.', 429)
  const body = await request.json().catch(() => null) as { id?: unknown; all?: unknown } | null
  if (body?.all === true) {
    await db.update(socialNotifications).set({ readAt: new Date() }).where(and(eq(socialNotifications.recipientId, viewer.id), isNull(socialNotifications.readAt)))
  } else if (body && validId(body.id)) {
    await db.update(socialNotifications).set({ readAt: new Date() }).where(and(eq(socialNotifications.id, body.id), eq(socialNotifications.recipientId, viewer.id), isNull(socialNotifications.readAt)))
  } else return jsonError('الإشعار غير صالح.', 400)
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}
