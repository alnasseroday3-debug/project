import { and, eq, gt, isNotNull, notInArray } from 'drizzle-orm'
import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

const demoListingIds = ['demo-camry', 'demo-mercedes', 'demo-tucson', 'demo-porsche']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = new URL('https://odeu.vercel.app')
  const now = new Date()
  const listings = await db
    .select({ id: carListings.id, updatedAt: carListings.updatedAt })
    .from(carListings)
    .where(and(
      eq(carListings.status, 'approved'),
      isNotNull(carListings.publishedAt),
      gt(carListings.expiresAt, now),
      eq(carListings.hiddenByOwner, false),
      notInArray(carListings.id, demoListingIds),
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
