import { eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdminEmail } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { supportTickets } from '@/lib/db/schema'

function isSameOrigin(request: NextRequest) {
  return request.headers.get('origin') === new URL(request.url).origin
}

export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  const isAdmin = Boolean(session?.user && isAdminEmail(session.user.email, session.user.emailVerified, session.user.role))
  if (!isAdmin) return NextResponse.json({ success: false, message: 'غير مصرح.' }, { status: 403 })
  if (!isSameOrigin(request)) return NextResponse.json({ success: false, message: 'الطلب غير مصرح.' }, { status: 403 })
  if (Number(request.headers.get('content-length') ?? 0) > 1000) return NextResponse.json({ success: false, message: 'حجم الطلب أكبر من المسموح.' }, { status: 413 })

  try {
    const body: unknown = await request.json()
    const id = body && typeof body === 'object' && 'id' in body && typeof body.id === 'number' ? body.id : NaN
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ success: false, message: 'معرّف الطلب غير صالح.' }, { status: 400 })

    const deleted = await db.delete(supportTickets).where(eq(supportTickets.id, id)).returning({ id: supportTickets.id })
    if (deleted.length === 0) return NextResponse.json({ success: false, message: 'طلب الدعم غير موجود.' }, { status: 404 })
    return NextResponse.json({ success: true, message: 'تم حذف طلب الدعم.' })
  } catch (error) {
    console.error('[v0] Failed to delete support ticket:', error)
    return NextResponse.json({ success: false, message: 'تعذّر حذف طلب الدعم الآن.' }, { status: 500 })
  }
}
