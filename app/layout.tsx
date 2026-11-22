import { Analytics } from '@vercel/analytics/next'
import { and, count, eq, ne } from 'drizzle-orm'
import type { Metadata, Viewport } from 'next'
import { SiteFooter } from '@/components/marketplace/site-footer'
import { SiteHeader } from '@/components/marketplace/site-header'
import { SupportContact } from '@/components/marketplace/support-contact'
import { getCurrentSession, isAdminEmail } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'مَسَار | سوق السيارات في سوريا',
    template: '%s | مَسَار',
  },
  description: 'اكتشف سيارات مستعملة وجديدة في سوريا بإعلانات واضحة ومراجعة دقيقة. مَسَار يقرّبك من سيارتك القادمة بثقة.',
  applicationName: 'مَسَار',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
  themeColor: '#e5e7eb',
}

export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getCurrentSession()
  const isAdmin = Boolean(session?.user && isAdminEmail(session.user.email, session.user.emailVerified, session.user.role))
  let pendingCount = 0
  let myListingsCount = 0
  if (session?.user) {
    const [result] = await db
      .select({ total: count() })
      .from(carListings)
      .where(and(eq(carListings.userId, session.user.id), ne(carListings.status, 'archived')))
    myListingsCount = result?.total ?? 0
  }
  if (isAdmin) {
    const [result] = await db
      .select({ total: count() })
      .from(carListings)
      .where(eq(carListings.status, 'pending'))
    pendingCount = result?.total ?? 0
  }

  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">
        <SiteHeader isAdmin={isAdmin} pendingCount={pendingCount} myListingsCount={myListingsCount} sessionUser={session?.user ?? null} />
        {children}
        <SiteFooter isAdmin={isAdmin} />
        <SupportContact />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
