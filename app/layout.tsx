import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { SiteFooter } from '@/components/marketplace/site-footer'
import { SiteHeader } from '@/components/marketplace/site-header'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'مَسَار | سوق السيارات في السعودية',
    template: '%s | مَسَار',
  },
  description: 'اكتشف سيارات مستعملة وجديدة بإعلانات واضحة ومراجعة دقيقة. مَسَار يقرّبك من سيارتك القادمة بثقة.',
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
  themeColor: '#f6f5f0',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">
        <SiteHeader />
        {children}
        <SiteFooter />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
