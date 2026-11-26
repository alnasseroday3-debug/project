import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdminEmail } from '@/lib/auth-helpers'
import { deleteListingBlobs } from '@/lib/blob-storage'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'
import { sanitizePlainText } from '@/lib/sanitize-text'

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  return origin === new URL(request.url).origin
}

function isAdmin(session: Awaited<ReturnType<typeof auth.api.getSession>>) {
  return Boolean(session?.user && isAdminEmail(session.user.email, session.user.emailVerified, session.user.role))
}

function isValidId(id: string) {
  return typeof id === 'string' && id.trim().length > 0 && id.length <= 128
}

export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!isAdmin(session)) return NextResponse.json({ success: false, message: 'غير مصرح.' }, { status: 403 })
  if (!isSameOrigin(request)) return NextResponse.json({ success: false, message: 'الطلب غير مصرح.' }, { status: 403 })

  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, message: 'بيانات المراجعة غير صالحة.' }, { status: 400 })
    }

    const values = body as Record<string, unknown>
    const id = typeof values.id === 'string' ? values.id.trim().slice(0, 128) : ''
    if (!isValidId(id)) {
      return NextResponse.json({ success: false, message: 'معرّف الإعلان غير صالح.' }, { status: 400 })
    }

    const action = typeof values.action === 'string' ? values.action : ''
    const status = typeof values.status === 'string' ? values.status : ''
    const verified = values.verified === true
    const rejectionReason = sanitizePlainText(values.rejectionReason, 2000)
    const now = new Date()

    if (action === 'archive-pending' || action === 'archive') {
      const updated = await db
        .update(carListings)
        .set({ status: 'archived', archivedByAdmin: true, archivedByExpiry: false, updatedAt: now })
        .where(eq(carListings.id, id))
        .returning({ id: carListings.id })

      if (!updated.length) {
        return NextResponse.json({ success: false, message: 'الإعلان غير موجود.' }, { status: 404 })
      }
    } else if (action === 'restore-pending') {
      const updated = await db
        .update(carListings)
        .set({
          status: 'pending',
          rejectionReason: null,
          publishedAt: null,
          expiresAt: null,
          archivedByAdmin: false,
          archivedByExpiry: false,
          hiddenByOwner: false,
          updatedAt: now,
        })
        .where(eq(carListings.id, id))
        .returning({ id: carListings.id })

      if (!updated.length) {
        return NextResponse.json({ success: false, message: 'الإعلان غير موجود.' }, { status: 404 })
      }
    } else if (action === 'republish' || status === 'approved') {
      const updated = await db
        .update(carListings)
        .set({
          status: 'approved',
          verified,
          rejectionReason: null,
          publishedAt: now,
          expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          archivedByAdmin: false,
          archivedByExpiry: false,
          hiddenByOwner: false,
          updatedAt: now,
        })
        .where(eq(carListings.id, id))
        .returning({ id: carListings.id })

      if (!updated.length) {
        return NextResponse.json({ success: false, message: 'الإعلان غير موجود.' }, { status: 404 })
      }
    } else if (status === 'rejected') {
      const updated = await db
        .update(carListings)
        .set({
          status: 'rejected',
          rejectionReason: rejectionReason || null,
          publishedAt: null,
          updatedAt: now,
        })
        .where(eq(carListings.id, id))
        .returning({ id: carListings.id })

      if (!updated.length) {
        return NextResponse.json({ success: false, message: 'الإعلان غير موجود.' }, { status: 404 })
      }
    } else {
      return NextResponse.json({ success: false, message: 'إجراء المراجعة غير صالح.' }, { status: 400 })
    }

    revalidatePath('/')
    revalidatePath('/admin')
    revalidatePath('/my-listings')
    revalidatePath(`/cars/${id}`)
    return NextResponse.json({ success: true, message: 'تم تحديث حالة الإعلان بنجاح.' })
  } catch {
    return NextResponse.json({ success: false, message: 'تعذّر تحديث الإعلان.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!isAdmin(session)) return NextResponse.json({ success: false, message: 'غير مصرح.' }, { status: 403 })
  if (!isSameOrigin(request)) return NextResponse.json({ success: false, message: 'الطلب غير مصرح.' }, { status: 403 })

  try {
    const urlId = request.nextUrl.searchParams.get('id')
    const body = (await request.json().catch(() => null)) as { id?: unknown } | null
    const rawId = typeof urlId === 'string' && urlId ? urlId : typeof body?.id === 'string' ? body.id : ''
    const id = rawId.trim().slice(0, 128)

    if (!isValidId(id)) {
      return NextResponse.json({ success: false, message: 'معرّف الإعلان غير صالح.' }, { status: 400 })
    }

    const [listing] = await db
      .select({ id: carListings.id, images: carListings.images })
      .from(carListings)
      .where(eq(carListings.id, id))
      .limit(1)

    if (!listing) {
      return NextResponse.json({ success: false, message: 'الإعلان غير موجود.' }, { status: 404 })
    }

    if (Array.isArray(listing.images) && listing.images.length > 0) {
      await deleteListingBlobs(listing.images).catch(() => {})
    }

    await db.delete(carListings).where(and(eq(carListings.id, id)))

    revalidatePath('/')
    revalidatePath('/admin')
    revalidatePath('/my-listings')
    revalidatePath(`/cars/${id}`)
    return NextResponse.json({ success: true, message: 'تم حذف الإعلان نهائياً.' })
  } catch {
    return NextResponse.json({ success: false, message: 'تعذّر حذف الإعلان.' }, { status: 500 })
  }
                    }
                    
