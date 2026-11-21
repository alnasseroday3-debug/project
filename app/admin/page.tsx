import { asc, desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { AdminDashboard } from '@/components/marketplace/admin-dashboard'
import { getCurrentSession, isAdminSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await getCurrentSession()
  if (!session?.user) redirect('/sign-in?next=%2Fadmin')
  if (!(await isAdminSession())) redirect('/')

  const [pending, published, archived] = await Promise.all([
    db.select().from(carListings).where(eq(carListings.status, 'pending')).orderBy(asc(carListings.createdAt)),
    db.select().from(carListings).where(eq(carListings.status, 'approved')).orderBy(desc(carListings.updatedAt)),
    db.select().from(carListings).where(eq(carListings.status, 'archived')).orderBy(desc(carListings.updatedAt)),
  ])

  return <AdminDashboard listings={pending} publishedListings={published} archivedListings={archived} />
}
