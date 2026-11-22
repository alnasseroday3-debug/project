import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/my-listings', '/sign-in', '/sign-up', '/api/'],
    },
    sitemap: new URL('/sitemap.xml', 'https://odeu.vercel.app').toString(),
  }
}
