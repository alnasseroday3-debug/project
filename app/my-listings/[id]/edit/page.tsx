import { and, eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { ListingWizard } from '@/components/marketplace/listing-wizard'
import { getCurrentSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

type EditListingPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditRejectedListingPage({ params }: EditListingPageProps) {
  const session = await getCurrentSession()
  if (!session?.user) redirect('/sign-in?next=%2Fmy-listings')

  const { id } = await params
  const [listing] = await db
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
      usageMonths: carListings.usageMonths,
      maintenanceVisited: carListings.maintenanceVisited,
      maintenanceReason: carListings.maintenanceReason,
      repaired: carListings.repaired,
      repairDetails: carListings.repairDetails,
      partsChanged: carListings.partsChanged,
      changedParts: carListings.changedParts,
      askingPrice: carListings.askingPrice,
      negotiationMin: carListings.negotiationMin,
      negotiationMax: carListings.negotiationMax,
      negotiable: carListings.negotiable,
      paintCondition: carListings.paintCondition,
      paintDetails: carListings.paintDetails,
      transmission: carListings.transmission,
      fuelType: carListings.fuelType,
      registrationStatus: carListings.registrationStatus,
      whatsappOnly: carListings.whatsappOnly,
      city: carListings.city,
      description: carListings.description,
      sellerPhone: carListings.sellerPhone,
      images: carListings.images,
      verificationImage: carListings.verificationImage,
    })
    .from(carListings)
    .where(and(eq(carListings.id, id), eq(carListings.userId, session.user.id), eq(carListings.status, 'rejected')))
    .limit(1)

  if (!listing) notFound()
  const { verificationImage, ...editableListing } = listing

  return (
    <ListingWizard
      userId={session.user.id}
      userName={session.user.name}
      existingListing={{
        ...editableListing,
        condition: listing.condition === 'new' ? 'new' : 'used',
        hasVerificationImage: Boolean(verificationImage),
      }}
    />
  )
}
