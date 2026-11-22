import { and, desc, eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { carListings, listingComments, socialNotifications, user } from '@/lib/db/schema'
import { jsonError, isSocialAdmin, requireSocialUser, socialRateLimited, socialText, validId } from '@/lib/social/api'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { user: actor, response } = await requireSocialUser(request)
  if (response || !actor) return response
  if (await socialRateLimited('comment', actor.id, 20)) return jsonError('تم تجاوز عدد المحاولات. حاول لاحقاً.', 429)
  const body = await request.json().catch(() => null) as { listingId?: unknown; body?: unknown } | null
  const listingId = body?.listingId
  const text = socialText(body?.body, 1200)
  if (!body || !validId(listingId) || text.length < 1) return jsonError('اكتب تعليقاً صالحاً.', 400)
  const [listing] = await db.select({ id: carListings.id, ownerId: carListings.userId }).from(carListings)
    .where(and(eq(carListings.id, listingId), eq(carListings.status, 'approved'))).limit(1)
  if (!listing) return jsonError('الإعلان غير متاح.', 404)
  const [comment] = await db.insert(listingComments).values({ listingId, authorId: actor.id, body: text }).returning()
  if (listing.ownerId !== actor.id) {
    await db.insert(socialNotifications).values({ recipientId: listing.ownerId, actorId: actor.id, notificationType: 'comment', entityId: listingId })
  }
  const [author] = await db.select({ name: user.name, image: user.image }).from(user).where(eq(user.id, actor.id)).limit(1)
  return NextResponse.json({ comment: { ...comment, authorName: author?.name ?? actor.name, authorImage: author?.image ?? actor.image, canDelete: true } }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: NextRequest) {
  const { user: actor, response } = await requireSocialUser(request)
  if (response || !actor) return response
  if (await socialRateLimited('comment-delete', actor.id, 60)) return jsonError('تم تجاوز عدد المحاولات. حاول لاحقاً.', 429)
  const body = await request.json().catch(() => null) as { commentId?: unknown } | null
  if (!validId(body?.commentId)) return jsonError('التعليق غير صالح.', 400)
  const [comment] = await db.select({ id: listingComments.id, authorId: listingComments.authorId, listingOwnerId: carListings.userId })
    .from(listingComments).innerJoin(carListings, eq(carListings.id, listingComments.listingId))
    .where(eq(listingComments.id, body.commentId)).limit(1)
  if (!comment) return jsonError('التعليق غير موجود.', 404)
  if (comment.authorId !== actor.id && comment.listingOwnerId !== actor.id && !isSocialAdmin(actor)) return jsonError('غير مصرح بحذف هذا التعليق.', 403)
  await db.delete(listingComments).where(eq(listingComments.id, comment.id))
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}
