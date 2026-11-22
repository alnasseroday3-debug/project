import { and, desc, eq, sql } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { socialNotifications, user, userFollows } from '@/lib/db/schema'
import { jsonError, optionalSocialUser, requireSocialUser, socialRateLimited, socialText, validId } from '@/lib/social/api'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const ownerId = params.get('userId') ?? ''
  const type = params.get('type')
  if (!validId(ownerId) || (type !== 'followers' && type !== 'following')) return jsonError('تعذّر تحميل قائمة المتابعة.', 400)
  const viewer = await optionalSocialUser()
  const offsetValue = Number(params.get('offset') ?? 0)
  const offset = Number.isSafeInteger(offsetValue) && offsetValue >= 0 ? Math.min(offsetValue, 5000) : 0
  const relationship = type === 'followers' ? userFollows.followedId : userFollows.followerId
  const personColumn = type === 'followers' ? userFollows.followerId : userFollows.followedId
  const people = await db.select({
    id: user.id,
    name: user.name,
    username: user.username,
    image: user.image,
    governorate: user.governorate,
    isFollowing: viewer ? sql<boolean>`EXISTS (SELECT 1 FROM user_follows f WHERE f.follower_id = ${viewer.id} AND f.followed_id = ${user.id})` : sql<boolean>`false`,
  })
    .from(userFollows)
    .innerJoin(user, eq(user.id, personColumn))
    .where(eq(relationship, ownerId))
    .orderBy(desc(userFollows.createdAt))
    .limit(51)
    .offset(offset)
  return NextResponse.json({ users: people.slice(0, 50), hasMore: people.length > 50, offset }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const { user: actor, response } = await requireSocialUser(request)
  if (response || !actor) return response
  if (await socialRateLimited('follow', actor.id, 30)) return jsonError('تم تجاوز عدد المحاولات. حاول لاحقاً.', 429)
  const body = await request.json().catch(() => null) as { targetId?: unknown } | null
  const targetId = body?.targetId
  if (!validId(targetId) || targetId === actor.id) return jsonError('المستخدم غير صالح.', 400)
  const [target] = await db.select({ id: user.id }).from(user).where(eq(user.id, targetId)).limit(1)
  if (!target) return jsonError('المستخدم غير موجود.', 404)
  const inserted = await db.transaction(async (tx) => {
    const [follow] = await tx.insert(userFollows).values({ followerId: actor.id, followedId: targetId })
      .onConflictDoNothing().returning({ id: userFollows.followedId })
    if (follow) {
      await tx.insert(socialNotifications).values({ recipientId: targetId, actorId: actor.id, notificationType: 'follow' })
    }
    return follow
  })
  return NextResponse.json({ success: true, following: true, changed: Boolean(inserted) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: NextRequest) {
  const { user: actor, response } = await requireSocialUser(request)
  if (response || !actor) return response
  if (await socialRateLimited('unfollow', actor.id, 60)) return jsonError('تم تجاوز عدد المحاولات. حاول لاحقاً.', 429)
  const body = await request.json().catch(() => null) as { targetId?: unknown } | null
  const targetId = body?.targetId
  if (!validId(targetId) || targetId === actor.id) return jsonError('المستخدم غير صالح.', 400)
  await db.delete(userFollows).where(and(eq(userFollows.followerId, actor.id), eq(userFollows.followedId, targetId)))
  return NextResponse.json({ success: true, following: false }, { headers: { 'Cache-Control': 'no-store' } })
}
