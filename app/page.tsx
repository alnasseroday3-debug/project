import { and, desc, eq, gt, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import { HomePage } from '@/components/marketplace/home-page'
import { db } from '@/lib/db'
import { carListings, userFollows } from '@/lib/db/schema'
import { getCurrentSession } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: 'مَسار. | سوق سوريا الشامل للسيارات والعقارات والأجهزة والأثاث' },
  description: 'اكتشف السيارات والعقارات والأجهزة والأثاث في سوريا عبر مَسار، سوق شامل بإعلانات واضحة ومراجعة دقيقة وتواصل مباشر.',
}

export default async function Page() {
  const session = await getCurrentSession()
  const followedSeller = session?.user
    ? sql<boolean>`EXISTS (SELECT 1 FROM user_follows WHERE follower_id = ${session.user.id} AND followed_id = ${carListings.userId})`
    : sql<boolean>`false`
  const listings = await db
    .select({
      id: carListings.id,
      make: carListings.make,
      model: carListings.model,
      category: carListings.category,
      details: carListings.details,
      year: carListings.year,
      condition: carListings.condition,
      mileage: carListings.mileage,
      mileageUnknown: carListings.mileageUnknown,
      askingPrice: carListings.askingPrice,
      negotiable: carListings.negotiable,
      negotiationMin: carListings.negotiationMin,
      negotiationMax: carListings.negotiationMax,
      transmission: carListings.transmission,
      paintCondition: carListings.paintCondition,
      city: carListings.city,
      images: carListings.images,
      verified: carListings.verified,
      publishedAt: carListings.publishedAt,
      followedSeller,
    })
    .from(carListings)
    .where(and(eq(carListings.status, 'approved'), gt(carListings.expiresAt, new Date()), eq(carListings.hiddenByOwner, false)))
    .orderBy(...(session?.user ? [desc(followedSeller)] : []), sql`${carListings.publishedAt} DESC NULLS LAST`, desc(carListings.createdAt))
    .limit(13)

  const hasMore = listings.length > 12
  return <HomePage initialPage={{ items: hasMore ? listings.slice(0, 12) : listings, hasMore, pageSize: 12, offset: 0 }} isAuthenticated={Boolean(session?.user)} />
}
