import { and, asc, count, desc, eq, gt } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { AdminDashboard } from '@/components/marketplace/admin-dashboard'
import { getCurrentSession, isAdminSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { carListings, supportTickets, user } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await getCurrentSession()
  if (!session?.user) redirect('/sign-in?next=%2Fadmin')
  if (!(await isAdminSession())) redirect('/')

  const [pending, published, archived, support, usersCountResult] = await Promise.all([
    db.select().from(carListings).where(eq(carListings.status, 'pending')).orderBy(asc(carListings.createdAt)),
    db.select().from(carListings).where(and(eq(carListings.status, 'approved'), gt(carListings.expiresAt, new Date()))).orderBy(desc(carListings.publishedAt)),
    db.select().from(carListings).where(eq(carListings.status, 'archived')).orderBy(desc(carListings.updatedAt)),
    db.select({ id: supportTickets.id, reference: supportTickets.reference, fullName: supportTickets.fullName, whatsappNumber: supportTickets.whatsappNumber, category: supportTickets.category, message: supportTickets.message, createdAt: supportTickets.createdAt }).from(supportTickets).orderBy(desc(supportTickets.createdAt)),
    db.select({ total: count() }).from(user),
  ])

  const totalUsers = Number(usersCountResult[0]?.total ?? 0)

  return (
    <>
      <div className="page-container" style={{ paddingTop: '1rem', paddingBottom: 0 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.55rem 1rem',
            borderRadius: '999px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#34d399',
            fontWeight: 700,
            fontSize: '0.92rem',
          }}
        >
          <span>👥 إجمالي المستخدمين المسجلين في مَسَار:</span>
          <strong style={{ fontSize: '1.05rem', color: '#ffffff' }}>{totalUsers}</strong>
        </div>
      </div>
      <AdminDashboard listings={pending} publishedListings={published} archivedListings={archived} supportTickets={support} />
    </>
  )
                                              }
