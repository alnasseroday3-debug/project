import { and, eq, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'

export const LISTING_TERM_DAYS = 30
export const LISTING_TERM_MS = LISTING_TERM_DAYS * 24 * 60 * 60 * 1000

export async function archiveExpiredListings() {
  const now = new Date()
  await db
    .update(carListings)
    .set({ status: 'archived', archivedByAdmin: false, archivedByExpiry: true, updatedAt: now })
    .where(and(eq(carListings.status, 'approved'), lte(carListings.expiresAt, now)))
}

export function daysUntilExpiry(expiresAt: Date | null, now = Date.now()) {
  return expiresAt ? Math.ceil((expiresAt.getTime() - now) / (24 * 60 * 60 * 1000)) : null
}
