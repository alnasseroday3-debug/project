import { Analytics } from '@vercel/analytics/next'
import { and, count, eq, ne, or } from 'drizzle-orm'
import type { Metadata, Viewport } from 'next'
import { SiteFooter } from '@/components/marketplace/site-footer'
import { SiteHeader } from '@/components/marketplace/site-header'
import { SupportContact } from '@/components/marketplace/support-contact'
import { getCurrentSession, isAdminEmail } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'
import { archiveExpiredListings } from '@/lib/listing-lifecycle'
import { getSiteUrl } from '@/lib/site-url'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: 'مَسار. | سوق سوريا الشامل للسيارات والعقارات والأجهزة والأثاث',
    template: '%s | مَسار.',
  },
  description: 'اكتشف السيارات والعقارات والأجهزة والأثاث في سوريا عبر مَسار، سوق شامل بإعلانات واضحة ومراجعة دقيقة وتواصل مباشر.',
  openGraph: {
    title: 'مَسار. | سوق سوريا الشامل للسيارات والعقارات والأجهزة والأثاث',
    description: 'اكتشف السيارات والعقارات والأجهزة والأثاث في سوريا عبر مَسار، سوق شامل بإعلانات واضحة ومراجعة دقيقة وتواصل مباشر.',
    siteName: 'مَسار.',
    locale: 'ar_SY',
    type: 'website',
    images: ['/images/syrian-marketplace-hero.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'مَسار. | سوق سوريا الشامل للسيارات والعقارات والأجهزة والأثاث',
    description: 'اكتشف السيارات والعقارات والأجهزة والأثاث في سوريا عبر مَسار، سوق شامل بإعلانات واضحة ومراجعة دقيقة وتواصل مباشر.',
    images: ['/images/syrian-marketplace-hero.png'],
  },
  applicationName: 'مَسَار',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
  themeColor: '#0A0A0B',
}

export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  await archiveExpiredListings()
  const session = await getCurrentSession()
  const isAdmin = Boolean(session?.user && isAdminEmail(session.user.email, session.user.emailVerified, session.user.role))
  let pendingCount = 0
  let myListingsCount = 0
  if (session?.user) {
    const [result] = await db
      .select({ total: count() })
      .from(carListings)
      .where(and(
        eq(carListings.userId, session.user.id),
        eq(carListings.hiddenByOwner, false),
        or(ne(carListings.status, 'archived'), eq(carListings.archivedByAdmin, true), eq(carListings.archivedByExpiry, true)),
      ))
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
