import { randomUUID } from 'node:crypto'
import { put } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

const maxFileBytes = 4 * 1024 * 1024
const imageTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return NextResponse.json({ error: 'سجّل الدخول لرفع الصور.' }, { status: 401 })

  const formData = await request.formData()
  const entry = formData.get('file')
  if (!(entry instanceof File)) return NextResponse.json({ error: 'اختر صورة صالحة.' }, { status: 400 })

  const extension = imageTypes.get(entry.type)
  if (!extension || entry.size === 0 || entry.size > maxFileBytes) {
    return NextResponse.json({ error: 'الصورة يجب أن تكون JPG أو PNG أو WebP وأقل من 4 ميغابايت.' }, { status: 400 })
  }

  try {
    const pathname = `cars/${session.user.id}/${randomUUID()}.${extension}`
    const blob = await put(pathname, entry, {
      access: 'private',
      addRandomSuffix: false,
      contentType: entry.type,
    })
    return NextResponse.json({ pathname: blob.pathname })
  } catch (error) {
    console.error('[v0] Car photo upload failed:', error)
    return NextResponse.json({ error: 'تعذّر رفع الصورة. حاول مرة أخرى.' }, { status: 500 })
  }
}
