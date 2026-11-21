import { randomUUID } from 'node:crypto'
import { put } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { consumeRateLimit, getClientAddress } from '@/lib/rate-limit'

const maxFileBytes = 500_000

function safeUploadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const token = process.env.BLOB_READ_WRITE_TOKEN
  const redacted = token ? message.replaceAll(token, '[redacted]') : message
  return redacted
    .replace(/vercel_blob_rw_[A-Za-z0-9_-]+/gi, '[redacted token]')
    .replace(/(BLOB_READ_WRITE_TOKEN\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 240)
}
const imageTypes = new Map([
  ['image/jpeg', { extension: 'jpg', signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ['image/png', { extension: 'png', signature: (bytes: Uint8Array) => bytes.subarray(0, 8).join(',') === '137,80,78,71,13,10,26,10' }],
  ['image/webp', { extension: 'webp', signature: (bytes: Uint8Array) => new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP' }],
])

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return NextResponse.json({ error: 'سجّل الدخول لرفع الصور.' }, { status: 401 })
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'الطلب غير مصرح.' }, { status: 403 })
  }

  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxFileBytes + 32 * 1024) {
    return NextResponse.json({ error: 'حجم الصورة المضغوطة يتجاوز 500 كيلوبايت.' }, { status: 413 })
  }

  try {
    const [userAllowed, addressAllowed] = await Promise.all([
      consumeRateLimit('upload-user', session.user.id, 24, 60 * 60_000),
      consumeRateLimit('upload-ip', getClientAddress(request.headers), 60, 60 * 60_000),
    ])
    if (!userAllowed || !addressAllowed) {
      return NextResponse.json({ error: 'تجاوزت حد رفع الصور. حاول لاحقاً.' }, { status: 429 })
    }

    const formData = await request.formData()
    const entry = formData.get('file')
    const kind = formData.get('kind')
    if (!(entry instanceof File) || (kind !== 'car' && kind !== 'verification')) {
      return NextResponse.json({ error: 'اختر صورة صالحة.' }, { status: 400 })
    }
    if (entry.size === 0 || entry.size > maxFileBytes) {
      return NextResponse.json({ error: 'يجب أن تكون الصورة JPG أو PNG أو WebP وبحد أقصى 500 كيلوبايت.' }, { status: 400 })
    }

    const image = imageTypes.get(entry.type)
    const bytes = new Uint8Array(await entry.arrayBuffer())
    if (!image || !image.signature(bytes)) {
      return NextResponse.json({ error: 'محتوى الصورة لا يطابق صيغة JPG أو PNG أو WebP.' }, { status: 400 })
    }

    const prefix = kind === 'verification' ? 'verification' : 'cars'
    const pathname = `${prefix}/${session.user.id}/${randomUUID()}.${image.extension}`
    const blob = await put(pathname, entry, {
      access: 'private',
      addRandomSuffix: false,
      contentType: entry.type,
    })
    return NextResponse.json({ pathname: blob.pathname }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const diagnosticId = randomUUID().slice(0, 8)
    const details = safeUploadError(error) || 'خطأ غير معروف'
    console.error(`[v0] Car photo upload failed (${diagnosticId}):`, error)
    return NextResponse.json(
      { error: `تعذّر رفع الصورة: ${details} (مرجع ${diagnosticId})` },
      { status: 503 },
    )
  }
}
