import { redirect } from 'next/navigation'
import { ListingWizard } from '@/components/marketplace/listing-wizard'
import { getCurrentSession } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export default async function SellPage() {
  const session = await getCurrentSession()
  if (!session?.user) redirect('/sign-in?next=%2Fsell')

  return <ListingWizard userName={session.user.name} />
}
