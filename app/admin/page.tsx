import { and, asc, desc, eq, gt } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { AdminDashboard } from '@/components/marketplace/admin-dashboard'
import { getCurrentSession, isAdminSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { carListings, supportTickets } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await getCurrentSession()
  if (!session?.user) redirect('/sign-in?next=%2Fadmin')
  if (!(await isAdminSession())) redirect('/')

  const [pending, published, archived, support] = await Promise.all([
    db.select().from(carListings).where(eq(carListings.status, 'pending')).orderBy(asc(carListings.createdAt)),
    db.select().from(carListings).where(and(eq(carListings.status, 'approved'), gt(carListings.expiresAt, new Date()))).orderBy(desc(carListings.publishedAt)),
    db.select().from(carListings).where(eq(carListings.status, 'archived')).orderBy(desc(carListings.updatedAt)),
    db.select({ id: supportTickets.id, reference: supportTickets.reference, fullName: supportTickets.fullName, whatsappNumber: supportTickets.whatsappNumber, category: supportTickets.category, message: supportTickets.message, createdAt: supportTickets.createdAt }).from(supportTickets).orderBy(desc(supportTickets.createdAt)),
  ])

  return <AdminDashboard listings={pending} publishedListings={published} archivedListings={archived} supportTickets={support} />
}
