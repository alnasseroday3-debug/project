import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { getCurrentSession, isAdminEmail } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'

type RouteContext = {
  params: Promise<{ id: string }>
}

function isValidListingId(id: string) {
  return typeof id === 'string' && id.trim().length > 0 && id.length <= 128
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getCurrentSession()
  if (!session?.user || !isAdminEmail(session.user.email, session.user.emailVerified, session.user.role)) {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 })
  }

  const { id } = await context.params
  if (!isValidListingId(id)) {
    return NextResponse.json({ error: 'معرف الإعلان غير صالح.' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as { action?: string } | null
  if (!body || (body.action !== 'approve' && body.action !== 'reject')) {
    return NextResponse.json({ error: 'إجراء غير صالح.' }, { status: 400 })
  }

  const [updated] = await db
    .update(carListings)
    .set({
      status: body.action === 'approve' ? 'approved' : 'rejected',
      publishedAt: body.action === 'approve' ? new Date() : null,
    })
    .where(eq(carListings.id, id))
    .returning({ id: carListings.id, status: carListings.status })

  if (!updated) {
    return NextResponse.json({ error: 'الإعلان غير موجود.' }, { status: 404 })
  }

  revalidatePath('/')
  revalidatePath('/admin')
  return NextResponse.json({ listing: updated })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getCurrentSession()
  if (!session?.user || !isAdminEmail(session.user.email, session.user.emailVerified, session.user.role)) {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 })
  }

  const { id } = await context.params
  if (!isValidListingId(id)) {
    return NextResponse.json({ error: 'معرف الإعلان غير صالح.' }, { status: 400 })
  }

  const [deleted] = await db.delete(carListings).where(eq(carListings.id, id)).returning({ id: carListings.id })
  if (!deleted) {
    return NextResponse.json({ error: 'الإعلان غير موجود.' }, { status: 404 })
  }

  revalidatePath('/')
  revalidatePath('/admin')
  return NextResponse.json({ ok: true })
}
