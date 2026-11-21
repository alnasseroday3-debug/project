import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdminEmail } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'

export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user || !isAdminEmail(session.user.email, session.user.emailVerified, session.user.role)) {
    return NextResponse.json({ success: false, message: 'غير مصرح.' }, { status: 403 })
  }
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ success: false, message: 'الطلب غير مصرح.' }, { status: 403 })
  }

  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, message: 'بيانات المراجعة غير صالحة.' }, { status: 400 })
    }
    const values = body as Record<string, unknown>
    const id = typeof values.id === 'string' ? values.id.slice(0, 80) : ''
    const status = values.status
    const verified = values.verified === true
    const rejectionReason = typeof values.rejectionReason === 'string' ? values.rejectionReason : ''
    if (!id || (status !== 'approved' && status !== 'rejected') || typeof values.verified !== 'boolean') {
      return NextResponse.json({ success: false, message: 'بيانات المراجعة غير صالحة.' }, { status: 400 })
    }
    if (status === 'rejected' && (!rejectionReason.trim() || rejectionReason.length > 2000)) {
      return NextResponse.json({ success: false, message: 'اكتب سبب الرفض، بحد أقصى 2000 حرف.' }, { status: 400 })
    }

    if (status === 'approved') {
      const [pendingListing] = await db
        .select({ verificationImage: carListings.verificationImage })
        .from(carListings)
        .where(and(eq(carListings.id, id), eq(carListings.status, 'pending')))
        .limit(1)
      if (!pendingListing) {
        return NextResponse.json({ success: false, message: 'هذا الإعلان لم يعد قيد المراجعة.' }, { status: 409 })
      }
      if (!pendingListing.verificationImage) {
        return NextResponse.json({ success: false, message: 'لا يمكن نشر الإعلان قبل إرفاق صورة التحقق.' }, { status: 422 })
      }
    }

    const updated = await db
      .update(carListings)
      .set({ status, verified: status === 'approved' && verified, rejectionReason: status === 'rejected' ? rejectionReason : null, updatedAt: new Date() })
      .where(and(eq(carListings.id, id), eq(carListings.status, 'pending')))
      .returning({ id: carListings.id })
    if (updated.length === 0) {
      return NextResponse.json({ success: false, message: 'هذا الإعلان لم يعد قيد المراجعة.' }, { status: 409 })
    }

    revalidatePath('/')
    revalidatePath('/admin')
    revalidatePath('/my-listings')
    revalidatePath(`/cars/${id}`)
    return NextResponse.json({ success: true, message: status === 'approved' ? 'تم نشر الإعلان.' : 'تم رفض الإعلان.' })
  } catch (error) {
    console.error('[v0] Failed to review car listing:', error)
    return NextResponse.json({ success: false, message: 'تعذّر تحديث الإعلان الآن.' }, { status: 500 })
  }
}
