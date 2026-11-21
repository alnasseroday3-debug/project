import { desc, eq } from 'drizzle-orm'
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
    })
    .from(carListings)
    .where(eq(carListings.userId, session.user.id))
    .orderBy(desc(carListings.createdAt))

  return <MyListings listings={listings} />
}
