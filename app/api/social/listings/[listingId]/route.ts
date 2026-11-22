import { and, count, desc, eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { carListings, listingComments, listingLikes, user } from '@/lib/db/schema'
import { jsonError, isSocialAdmin, optionalSocialUser, requireSocialUser, socialRateLimited, validId } from '@/lib/social/api'

export const dynamic = 'force-dynamic'

type RouteProps = { params: Promise<{ listingId: string }> }

export async function GET(request: NextRequest, { params }: RouteProps) {
  const { listingId } = await params
  if (!validId(listingId)) return jsonError('الإعلان غير موجود.', 404)
  const [listing] = await db.select({ id: carListings.id, ownerId: carListings.userId, status: carListings.status })
    .from(carListings).where(eq(carListings.id, listingId)).limit(1)
  if (!listing || listing.status !== 'approved') return jsonError('الإعلان غير موجود.', 404)
  const viewer = await optionalSocialUser()
  const [likeResult] = await db.select({ total: count() }).from(listingLikes).where(eq(listingLikes.listingId, listingId))
  const [commentResult] = await db.select({ total: count() }).from(listingComments).where(eq(listingComments.listingId, listingId))
  const liked = viewer ? Boolean((await db.select({ userId: listingLikes.userId }).from(listingLikes).where(and(eq(listingLikes.listingId, listingId), eq(listingLikes.userId, viewer.id))).limit(1))[0]) : false
  const comments = await db.select({ id: listingComments.id, authorId: listingComments.authorId, authorName: user.name, authorImage: user.image, body: listingComments.body, createdAt: listingComments.createdAt })
    .from(listingComments).innerJoin(user, eq(user.id, listingComments.authorId))
    .where(eq(listingComments.listingId, listingId)).orderBy(desc(listingComments.createdAt)).limit(50)
  return NextResponse.json({ likeCount: likeResult?.total ?? 0, commentCount: commentResult?.total ?? 0, liked, comments: comments.map((item) => ({ ...item, canDelete: item.authorId === viewer?.id || listing.ownerId === viewer?.id || Boolean(viewer && isSocialAdmin(viewer)) })) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  const { user: actor, response } = await requireSocialUser(request)
  if (response || !actor) return response
  if (await socialRateLimited('like', actor.id, 100)) return jsonError('تم تجاوز عدد المحاولات. حاول لاحقاً.', 429)
  const { listingId } = await params
  if (!validId(listingId)) return jsonError('الإعلان غير موجود.', 404)
  const [listing] = await db.select({ id: carListings.id, status: carListings.status }).from(carListings).where(eq(carListings.id, listingId)).limit(1)
  if (!listing || listing.status !== 'approved') return jsonError('الإعلان غير متاح.', 404)
  const [existing] = await db.select({ userId: listingLikes.userId }).from(listingLikes).where(and(eq(listingLikes.userId, actor.id), eq(listingLikes.listingId, listingId))).limit(1)
  if (existing) await db.delete(listingLikes).where(and(eq(listingLikes.userId, actor.id), eq(listingLikes.listingId, listingId)))
  else await db.insert(listingLikes).values({ userId: actor.id, listingId }).onConflictDoNothing()
  const [result] = await db.select({ total: count() }).from(listingLikes).where(eq(listingLikes.listingId, listingId))
  return NextResponse.json({ liked: !existing, likeCount: result?.total ?? 0 }, { headers: { 'Cache-Control': 'no-store' } })
}
