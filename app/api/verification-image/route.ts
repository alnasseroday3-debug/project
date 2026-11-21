import { get } from '@vercel/blob'
import { eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdminEmail } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user || !isAdminEmail(session.user.email, session.user.emailVerified)) {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 })
  }

  const listingId = request.nextUrl.searchParams.get('listing')
  if (!listingId || listingId.length > 80) return NextResponse.json({ error: 'الصورة غير موجودة.' }, { status: 400 })

  const [listing] = await db
    .select({ verificationImage: carListings.verificationImage })
    .from(carListings)
    .where(eq(carListings.id, listingId))
    .limit(1)
  if (!listing?.verificationImage) return NextResponse.json({ error: 'الصورة غير موجودة.' }, { status: 404 })

  try {
    const result = await get(listing.verificationImage, { access: 'private' })
    if (!result) return NextResponse.json({ error: 'الصورة غير موجودة.' }, { status: 404 })
    return new Response(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType || 'application/octet-stream',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    })
  } catch (error) {
    console.error('[v0] Verification photo delivery failed:', error)
    return NextResponse.json({ error: 'تعذّر عرض الصورة.' }, { status: 500 })
  }
}
