import { randomUUID } from 'node:crypto'
import { del, put } from '@vercel/blob'
import { eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { jsonError, requireSocialUser, socialRateLimited } from '@/lib/social/api'

export const dynamic = 'force-dynamic'
const maxBytes = 2 * 1024 * 1024
const imageTypes = new Map([
  ['image/jpeg', { extension: 'jpg', valid: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ['image/png', { extension: 'png', valid: (bytes: Uint8Array) => bytes.subarray(0, 8).join(',') === '137,80,78,71,13,10,26,10' }],
  ['image/webp', { extension: 'webp', valid: (bytes: Uint8Array) => new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP' }],
])

function ownedProfileImage(value: string | null, userId: string) {
  if (!value) return false
  try {
    const url = new URL(value)
    const path = decodeURIComponent(url.pathname.slice(1))
    const [folder, owner, file, extra] = path.split('/')
    return url.protocol === 'https:' && url.hostname.endsWith('.public.blob.vercel-storage.com') && !url.search && !url.hash && folder === 'profiles' && owner === userId && !extra && /^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(file ?? '')
  } catch { return false }
}

export async function POST(request: NextRequest) {
  const { user: actor, response } = await requireSocialUser(request)
  if (response || !actor) return response
  if (await socialRateLimited('avatar-upload', actor.id, 5, 60 * 60_000)) return jsonError('تم تجاوز عدد محاولات تغيير الصورة. حاول لاحقاً.', 429)
  const length = Number(request.headers.get('content-length'))
  if (Number.isFinite(length) && length > maxBytes + 32 * 1024) return jsonError('يجب ألا يتجاوز حجم الصورة 2 ميغابايت.', 413)
  const formData = await request.formData().catch(() => null)
  const entry = formData?.get('file')
  if (!(entry instanceof File) || entry.size < 1 || entry.size > maxBytes) return jsonError('اختر صورة حتى 2 ميغابايت.', 400)
  const imageType = imageTypes.get(entry.type)
  const bytes = new Uint8Array(await entry.arrayBuffer())
  if (!imageType || !imageType.valid(bytes)) return jsonError('يسمح فقط بصور JPG وPNG وWebP أصلية.', 400)

  const [current] = await db.select({ image: user.image }).from(user).where(eq(user.id, actor.id)).limit(1)
  if (!current) return jsonError('الحساب غير موجود.', 404)
  const pathname = `profiles/${actor.id}/${randomUUID()}.${imageType.extension}`
  try {
    const blob = await put(pathname, Buffer.from(bytes), { access: 'public', addRandomSuffix: false, contentType: entry.type, cacheControlMaxAge: 60 * 60 * 24 * 365 })
    await db.update(user).set({ image: blob.url, updatedAt: new Date() }).where(eq(user.id, actor.id))
    if (ownedProfileImage(current.image, actor.id)) await del(current.image!).catch(() => undefined)
    return NextResponse.json({ success: true, image: blob.url }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return jsonError('تعذّر حفظ صورة الملف الشخصي الآن.', 503)
  }
}
