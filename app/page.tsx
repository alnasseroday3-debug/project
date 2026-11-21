import { desc, eq } from 'drizzle-orm'
import { HomePage } from '@/components/marketplace/home-page'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const cars = await db
    .select({
      id: carListings.id,
      make: carListings.make,
      model: carListings.model,
      year: carListings.year,
      condition: carListings.condition,
      mileage: carListings.mileage,
      askingPrice: carListings.askingPrice,
      city: carListings.city,
      images: carListings.images,
      verified: carListings.verified,
    })
    .from(carListings)
    .where(eq(carListings.status, 'approved'))
    .orderBy(desc(carListings.createdAt))
    .limit(24)

  return <HomePage cars={cars} />
}
