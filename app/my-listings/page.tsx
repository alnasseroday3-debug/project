import { and, desc, eq, ne, or } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { MyListings } from '@/components/marketplace/my-listings'
import { getCurrentSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export default async function MyListingsPage() {
  const session = await getCurrentSession()
  if (!session?.user) redirect('/sign-in?next=%2Fmy-listings')

  const listings = await db
    .select({
      id: carListings.id,
      make: carListings.make,
      model: carListings.model,
      year: carListings.year,
      condition: carListings.condition,
      askingPrice: carListings.askingPrice,
      status: carListings.status,
      images: carListings.images,
      rejectionReason: carListings.rejectionReason,
      expiresAt: carListings.expiresAt,
      directRenewals: carListings.directRenewals,
      archivedByAdmin: carListings.archivedByAdmin,
      archivedByExpiry: carListings.archivedByExpiry,
      hiddenByOwner: carListings.hiddenByOwner,
    })
    .from(carListings)
    .where(and(
      eq(carListings.userId, session.user.id),
      eq(carListings.hiddenByOwner, false),
      or(ne(carListings.status, 'archived'), eq(carListings.archivedByAdmin, true), eq(carListings.archivedByExpiry, true)),
    ))
    .orderBy(desc(carListings.createdAt))

  return <MyListings listings={listings} />
}
