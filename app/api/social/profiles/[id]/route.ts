import { and, count, desc, eq, gt, sql } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { carListings, user, userFollows } from '@/lib/db/schema'
import { jsonError, optionalSocialUser, validId } from '@/lib/social/api'

export const dynamic = 'force-dynamic'
type RouteProps = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteProps) {
  const { id } = await params
  if (!validId(id)) return jsonError('الملف الشخصي غير موجود.', 404)
  const viewer = await optionalSocialUser()
  const [person] = await db.select({ id: user.id, name: user.name, username: user.username, image: user.image, governorate: user.governorate, email: user.email, messagingPublicKey: user.messagingPublicKey })
    .from(user).where(eq(user.id, id)).limit(1)
  if (!person) return jsonError('الملف الشخصي غير موجود.', 404)
  const [followers] = await db.select({ total: count() }).from(userFollows).where(eq(userFollows.followedId, id))
  const [following] = await db.select({ total: count() }).from(userFollows).where(eq(userFollows.followerId, id))
  const isFollowing = viewer ? Boolean((await db.select({ followerId: userFollows.followerId }).from(userFollows).where(and(eq(userFollows.followerId, viewer.id), eq(userFollows.followedId, id))).limit(1))[0]) : false
  const listings = await db.select({ id: carListings.id, make: carListings.make, model: carListings.model, category: carListings.category, details: carListings.details, year: carListings.year, condition: carListings.condition, mileage: carListings.mileage, mileageUnknown: carListings.mileageUnknown, askingPrice: carListings.askingPrice, negotiable: carListings.negotiable, city: carListings.city, images: carListings.images, verified: carListings.verified, publishedAt: carListings.publishedAt })
    .from(carListings).where(and(eq(carListings.userId, id), eq(carListings.status, 'approved'), eq(carListings.hiddenByOwner, false), gt(carListings.expiresAt, new Date())))
    .orderBy(desc(carListings.publishedAt), desc(carListings.createdAt)).limit(24)
  return NextResponse.json({
    profile: { id: person.id, name: person.name, username: person.username, image: person.image, governorate: person.governorate, messagingPublicKey: person.messagingPublicKey, email: viewer?.id === person.id ? person.email : undefined, followerCount: followers?.total ?? 0, followingCount: following?.total ?? 0, isFollowing, isSelf: viewer?.id === person.id, isAuthenticated: Boolean(viewer) },
    listings,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
