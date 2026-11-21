import { eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdminEmail } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'
import { decryptVerificationImage, isOwnedPublicBlobUrl, verificationImageContentType } from '@/lib/blob-storage'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user || !isAdminEmail(session.user.email, session.user.emailVerified, session.user.role)) {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 })
  }

  const listingId = request.nextUrl.searchParams.get('listing')
  if (!listingId || listingId.length > 80) return NextResponse.json({ error: 'الصورة غير موجودة.' }, { status: 400 })

  const [listing] = await db
    .select({ verificationImage: carListings.verificationImage, userId: carListings.userId })
    .from(carListings)
    .where(eq(carListings.id, listingId))
    .limit(1)
  if (!listing?.verificationImage || !isOwnedPublicBlobUrl(listing.verificationImage, 'verification', listing.userId)) {
    return NextResponse.json({ error: 'الصورة غير موجودة.' }, { status: 404 })
  }

  try {
    const blobResponse = await fetch(listing.verificationImage, { cache: 'no-store' })
    if (!blobResponse.ok) return NextResponse.json({ error: 'الصورة غير موجودة.' }, { status: 404 })
    const encryptedImage = new Uint8Array(await blobResponse.arrayBuffer())
    const image = decryptVerificationImage(encryptedImage)
    return new Response(image, {
      headers: {
        'Content-Type': verificationImageContentType(listing.verificationImage),
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
