import { and, eq, gt } from 'drizzle-orm'
import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'
import { getSiteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const now = new Date()
  const listings = await db
    .select({ id: carListings.id, updatedAt: carListings.updatedAt })
    .from(carListings)
    .where(and(
      eq(carListings.status, 'approved'),
      gt(carListings.expiresAt, now),
      eq(carListings.hiddenByOwner, false),
    ))

  return [
    {
      url: new URL('/', siteUrl).toString(),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    ...listings.map((listing) => ({
      url: new URL(`/cars/${encodeURIComponent(listing.id)}`, siteUrl).toString(),
      lastModified: listing.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
