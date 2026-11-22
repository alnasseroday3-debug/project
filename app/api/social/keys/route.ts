import { eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { jsonError, requireSocialUser, socialRateLimited, validBase64 } from '@/lib/social/api'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest) {
  const { user: actor, response } = await requireSocialUser(request)
  if (response || !actor) return response
  if (await socialRateLimited('message-key', actor.id, 10, 60_000)) return jsonError('تم تجاوز عدد المحاولات. حاول لاحقاً.', 429)
  const body = await request.json().catch(() => null) as { publicKey?: unknown } | null
  if (!body || !validBase64(body.publicKey, 2048)) return jsonError('مفتاح التشفير غير صالح.', 400)
  await db.update(user).set({ messagingPublicKey: body.publicKey }).where(eq(user.id, actor.id))
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}
