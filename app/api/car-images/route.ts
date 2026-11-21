import { get } from '@vercel/blob'
import { eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'
import { isAdminEmail } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  const listingId = request.nextUrl.searchParams.get('listing')
  const pathname = request.nextUrl.searchParams.get('path')
  if (!listingId || !pathname || pathname.length > 500) {
    return NextResponse.json({ error: 'الصورة غير موجودة.' }, { status: 400 })
  }

  const [listing] = await db
    .select({ id: carListings.id, userId: carListings.userId, images: carListings.images, status: carListings.status })
    .from(carListings)
    .where(eq(carListings.id, listingId))
    .limit(1)
  if (!listing || !listing.images.includes(pathname)) {
    return NextResponse.json({ error: 'الصورة غير موجودة.' }, { status: 404 })
  }

  if (listing.status !== 'approved') {
    const session = await auth.api.getSession({ headers: request.headers })
    const isOwner = session?.user.id === listing.userId
    const isAdmin = Boolean(session?.user && isAdminEmail(session.user.email, session.user.emailVerified))
    if (!isOwner && !isAdmin) return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 })
  }

  try {
    const result = await get(pathname, { access: 'private' })
    if (!result) return NextResponse.json({ error: 'الصورة غير موجودة.' }, { status: 404 })
    return new Response(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType || 'application/octet-stream',
        'Cache-Control': listing.status === 'approved' ? 'public, max-age=3600, stale-while-revalidate=86400' : 'private, no-store',
        ETag: result.blob.etag,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[v0] Private car photo delivery failed:', error)
    return NextResponse.json({ error: 'تعذّر عرض الصورة.' }, { status: 500 })
  }
}
