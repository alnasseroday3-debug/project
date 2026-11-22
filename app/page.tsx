import { and, desc, eq, gt } from 'drizzle-orm'
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
    })
    .from(carListings)
    .where(and(eq(carListings.status, 'approved'), gt(carListings.expiresAt, new Date())))
    .orderBy(desc(carListings.publishedAt))

  return <HomePage cars={cars} />
}
