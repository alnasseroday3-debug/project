import { eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'
import { isAdminEmail } from '@/lib/auth-helpers'
import { isOwnedPublicBlobUrl } from '@/lib/blob-storage'

export async function GET(request: NextRequest) {
  const listingId = request.nextUrl.searchParams.get('listing')
  const pathname = request.nextUrl.searchParams.get('path')
  if (!listingId || !pathname || pathname.length > 500) {
    return NextResponse.json({ error: 'الصورة غير موجودة.' }, { status: 400 })
  }

  const [listing] = await db
    .select({ id: carListings.id, userId: carListings.userId, images: carListings.images, status: carListings.status, expiresAt: carListings.expiresAt })
    .from(carListings)
    .where(eq(carListings.id, listingId))
    .limit(1)
  if (!listing || !listing.images.includes(pathname) || !isOwnedPublicBlobUrl(pathname, 'cars', listing.userId)) {
    return NextResponse.json({ error: 'الصورة غير موجودة.' }, { status: 404 })
  }

  const isCurrentlyPublic = listing.status === 'approved' && (!listing.expiresAt || listing.expiresAt > new Date())
  if (!isCurrentlyPublic) {
    const session = await auth.api.getSession({ headers: request.headers })
    const isOwner = session?.user.id === listing.userId
    const isAdmin = Boolean(session?.user && isAdminEmail(session.user.email, session.user.emailVerified, session.user.role))
    if (!session?.user) return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 })
    if (!isOwner && !isAdmin) return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 })
  }

  const response = NextResponse.redirect(new URL(pathname))
  response.headers.set('Cache-Control', isCurrentlyPublic ? 'public, max-age=3600, stale-while-revalidate=86400' : 'private, no-store')
  return response
}
