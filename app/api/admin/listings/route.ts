import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdminEmail } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'
import { deleteListingBlobs } from '@/lib/blob-storage'

function isSameOrigin(request: NextRequest) {
  return request.headers.get('origin') === new URL(request.url).origin
}

function isAdmin(session: Awaited<ReturnType<typeof auth.api.getSession>>) {
  return Boolean(session?.user && isAdminEmail(session.user.email, session.user.emailVerified, session.user.role))
}

export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!isAdmin(session)) return NextResponse.json({ success: false, message: 'غير مصرح.' }, { status: 403 })
  if (!isSameOrigin(request)) return NextResponse.json({ success: false, message: 'الطلب غير مصرح.' }, { status: 403 })

  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') return NextResponse.json({ success: false, message: 'بيانات المراجعة غير صالحة.' }, { status: 400 })
    const values = body as Record<string, unknown>
    const id = typeof values.id === 'string' ? values.id.slice(0, 80) : ''
    const status = values.status
    const verified = values.verified === true
    const rejectionReason = typeof values.rejectionReason === 'string' ? values.rejectionReason : ''

    if (values.action === 'archive-pending') {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false, message: 'معرّف الإعلان غير صالح.' }, { status: 400 })
      const archived = await db.update(carListings)
        .set({ status: 'archived', archivedByAdmin: true, archivedByExpiry: false, updatedAt: new Date() })
        .where(and(eq(carListings.id, id), eq(carListings.status, 'pending')))
        .returning({ id: carListings.id })
      if (archived.length === 0) {
        return NextResponse.json({ success: false, message: 'هذا الإعلان لم يعد قيد المراجعة.' }, { status: 409 })
      }
      revalidatePath('/')
      revalidatePath('/admin')
      revalidatePath('/my-listings')
      revalidatePath(`/cars/${id}`)
      return NextResponse.json({ success: true, message: 'تم حذف الطلب وأرشفته دون إرساله إلى المعلن.' })
    }

    if (values.action === 'restore-pending') {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false, message: 'معرّف الإعلان غير صالح.' }, { status: 400 })
      const updated = await db.update(carListings)
        .set({ status: 'pending', rejectionReason: null, publishedAt: null, expiresAt: null, archivedByAdmin: false, archivedByExpiry: false, hiddenByOwner: false, updatedAt: new Date() })
        .where(and(eq(carListings.id, id), eq(carListings.status, 'archived')))
        .returning({ id: carListings.id })
      if (!updated.length) return NextResponse.json({ success: false, message: 'تغيرت حالة الإعلان. حدّث الصفحة وحاول مجدداً.' }, { status: 409 })
      revalidatePath('/')
      revalidatePath('/admin')
      revalidatePath('/my-listings')
      revalidatePath(`/cars/${id}`)
      return NextResponse.json({ success: true, message: 'أُعيد الإعلان إلى قائمة طلبات المراجعة.' })
    }

    if (values.action === 'archive' || values.action === 'republish') {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false, message: 'معرّف الإعلان غير صالح.' }, { status: 400 })
      const archiving = values.action === 'archive'
      const now = new Date()
      const updated = await db.update(carListings)
        .set(archiving
          ? { status: 'archived', archivedByAdmin: true, archivedByExpiry: false, updatedAt: now }
          : { status: 'approved', rejectionReason: null, publishedAt: now, expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), directRenewals: 0, archivedByAdmin: false, archivedByExpiry: false, hiddenByOwner: false, updatedAt: now })
        .where(and(eq(carListings.id, id), eq(carListings.status, archiving ? 'approved' : 'archived')))
        .returning({ id: carListings.id })
      if (updated.length === 0) {
        return NextResponse.json({ success: false, message: 'تغيرت حالة الإعلان. حدّث الصفحة وحاول مجدداً.' }, { status: 409 })
      }
      revalidatePath('/')
      revalidatePath('/admin')
      revalidatePath('/my-listings')
      revalidatePath(`/cars/${id}`)
      return NextResponse.json({ success: true, message: archiving ? 'تم نقل الإعلان إلى الأرشيف.' : 'تمت إعادة نشر الإعلان لمدة 30 يوماً.' })
    }

    const sourceStatus = values.sourceStatus === 'archived' ? 'archived' : 'pending'
    if (!id || (status !== 'approved' && status !== 'rejected') || typeof values.verified !== 'boolean' || (sourceStatus === 'archived' && status !== 'rejected')) {
      return NextResponse.json({ success: false, message: 'بيانات المراجعة غير صالحة.' }, { status: 400 })
    }
    if (status === 'rejected' && (!rejectionReason.trim() || rejectionReason.length > 2000)) {
      return NextResponse.json({ success: false, message: 'اكتب سبب الرفض، بحد أقصى 2000 حرف.' }, { status: 400 })
    }

    if (status === 'approved') {
      const [pendingListing] = await db.select({ verificationImage: carListings.verificationImage }).from(carListings)
        .where(and(eq(carListings.id, id), eq(carListings.status, 'pending'))).limit(1)
      if (!pendingListing) return NextResponse.json({ success: false, message: 'هذا الإعلان لم يعد قيد المراجعة.' }, { status: 409 })
      if (!pendingListing.verificationImage) return NextResponse.json({ success: false, message: 'لا يمكن نشر الإعلان قبل إرفاق صورة التحقق.' }, { status: 422 })
    }

    const now = new Date()
    const updated = await db.update(carListings)
      .set(status === 'approved'
        ? { status, verified, rejectionReason: null, publishedAt: now, expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), directRenewals: 0, archivedByAdmin: false, archivedByExpiry: false, hiddenByOwner: false, updatedAt: now }
        : { status, verified: false, rejectionReason, publishedAt: null, expiresAt: null, archivedByAdmin: false, archivedByExpiry: false, hiddenByOwner: false, updatedAt: now })
      .where(and(eq(carListings.id, id), eq(carListings.status, sourceStatus)))
      .returning({ id: carListings.id })
    if (updated.length === 0) return NextResponse.json({ success: false, message: 'تغيرت حالة الإعلان. حدّث الصفحة وحاول مجدداً.' }, { status: 409 })

    revalidatePath('/')
    revalidatePath('/admin')
    revalidatePath('/my-listings')
    revalidatePath(`/cars/${id}`)
    return NextResponse.json({ success: true, message: status === 'approved' ? 'تم نشر الإعلان لمدة 30 يوماً.' : 'تم رفض الإعلان وإرسال السبب إلى صاحبه.' })
  } catch (error) {
    console.error('[v0] Failed to review car listing:', error)
    return NextResponse.json({ success: false, message: 'تعذّر تحديث الإعلان الآن.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!isAdmin(session)) return NextResponse.json({ success: false, message: 'غير مصرح.' }, { status: 403 })
  if (!isSameOrigin(request)) return NextResponse.json({ success: false, message: 'الطلب غير مصرح.' }, { status: 403 })

  try {
    const body: unknown = await request.json()
    const id = body && typeof body === 'object' && 'id' in body && typeof body.id === 'string' ? body.id : ''
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false, message: 'معرّف الإعلان غير صالح.' }, { status: 400 })

    const [listing] = await db.select({ id: carListings.id, status: carListings.status, userId: carListings.userId, images: carListings.images, verificationImage: carListings.verificationImage })
      .from(carListings).where(eq(carListings.id, id)).limit(1)
    if (!listing) return NextResponse.json({ success: false, message: 'الإعلان غير موجود.' }, { status: 404 })
    if (listing.status !== 'archived') {
      return NextResponse.json({ success: false, message: 'انقل الإعلان إلى الأرشيف قبل حذفه نهائياً.' }, { status: 409 })
    }

    const deleted = await db.delete(carListings)
      .where(and(eq(carListings.id, listing.id), eq(carListings.status, 'archived')))
      .returning({ id: carListings.id })
    if (deleted.length === 0) return NextResponse.json({ success: false, message: 'تغيرت بيانات الإعلان. حدّث الصفحة وحاول مجدداً.' }, { status: 409 })

    const filesRemoved = await deleteListingBlobs(listing.images, listing.verificationImage, listing.userId)
    revalidatePath('/')
    revalidatePath('/admin')
    revalidatePath('/my-listings')
    revalidatePath(`/cars/${listing.id}`)
    return NextResponse.json({ success: true, message: filesRemoved ? 'تم حذف الإعلان وصوره نهائياً.' : 'تم حذف الإعلان، لكن تعذّر حذف بعض الصور تلقائياً.' })
  } catch (error) {
    console.error('[v0] Failed to permanently delete car listing:', error)
    return NextResponse.json({ success: false, message: 'تعذّر حذف الإعلان الآن.' }, { status: 500 })
  }
}
