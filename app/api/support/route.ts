import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { and, count, eq, gte, sql } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getClientAddress } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { supportTickets, type SupportCategory } from '@/lib/db/schema'
import { isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone'

export const dynamic = 'force-dynamic'

const challengeLifetimeSeconds = 5 * 60
const requestWindowMs = 60 * 60 * 1000
const requestLimit = 3
const categories = new Set<SupportCategory>(['technical_issue', 'listing_question', 'report_violation', 'general_inquiry'])

type ChallengePayload = { first: number; second: number; expiresAt: number; nonce: string }

function secretKey() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('Support challenge signing is not configured.')
  return secret
}

function signChallenge(payload: string) {
  return createHmac('sha256', secretKey()).update(payload).digest('base64url')
}

function createChallenge() {
  const first = randomInt(2, 10)
  const second = randomInt(1, 10)
  const payload: ChallengePayload = {
    first,
    second,
    expiresAt: Math.floor(Date.now() / 1000) + challengeLifetimeSeconds,
    nonce: randomBytes(18).toString('base64url'),
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return { challengeId: `${encoded}.${signChallenge(encoded)}`, question: `كم ناتج ${first} + ${second}؟` }
}

function verifyChallenge(token: string): ChallengePayload | null {
  if (token.length > 1024) return null
  const [encoded, signature, extra] = token.split('.')
  if (!encoded || !signature || extra !== undefined) return null

  const expected = Buffer.from(signChallenge(encoded), 'base64url')
  const supplied = Buffer.from(signature, 'base64url')
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null

  try {
    const payload: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (!payload || typeof payload !== 'object') return null
    const value = payload as Record<string, unknown>
    if (!Number.isInteger(value.first) || !Number.isInteger(value.second) || typeof value.expiresAt !== 'number' || value.expiresAt < Math.floor(Date.now() / 1000) || typeof value.nonce !== 'string' || !/^[A-Za-z0-9_-]{20,64}$/.test(value.nonce)) return null
    return value as ChallengePayload
  } catch {
    return null
  }
}

function cleanText(value: unknown, maximum: number) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, maximum)
}

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
}

function getIpHash(request: NextRequest) {
  return createHmac('sha256', secretKey()).update(getClientAddress(request.headers).slice(0, 512)).digest('hex')
}

function isSameOrigin(request: NextRequest) {
  return request.headers.get('origin') === new URL(request.url).origin
}

function createWhatsAppUrl(name: string, category: SupportCategory, message: string, reference: string) {
  const phone = (process.env.ADMIN_WHATSAPP ?? '').replace(/\D/g, '')
  if (phone.length < 8 || phone.length > 15) return null
  const categoryLabel = {
    technical_issue: 'مشكلة تقنية',
    listing_question: 'استفسار عن إعلان',
    report_violation: 'الإبلاغ عن مخالفة',
    general_inquiry: 'استفسار عام',
  }[category]
  const text = `طلب دعم جديد من مَسَار\nرقم المرجع: ${reference}\nالاسم: ${name}\nنوع الطلب: ${categoryLabel}\nالتفاصيل: ${message}`
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    return NextResponse.json({ ...createChallenge(), phoneNumber: session?.user.phoneNumber ?? '' }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch {
    return NextResponse.json({ message: 'خدمة التحقق غير متاحة حالياً.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ message: 'الطلب غير مصرح.' }, { status: 403 })
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 12_000) return NextResponse.json({ message: 'حجم الطلب أكبر من المسموح.' }, { status: 413 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'بيانات الطلب غير صالحة.' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ message: 'بيانات الطلب غير صالحة.' }, { status: 400 })

  const values = body as Record<string, unknown>
  const name = cleanText(values.name, 120)
  const whatsappNumber = normalizePhoneNumber(cleanText(values.whatsappNumber, 32))
  const message = cleanText(values.message, 500)
  const category = values.category
  const answer = normalizeDigits(cleanText(values.captchaAnswer, 4))
  const challenge = typeof values.challengeId === 'string' ? verifyChallenge(values.challengeId) : null

  if (name.length < 2 || !isValidPhoneNumber(whatsappNumber) || message.length < 10 || typeof category !== 'string' || !categories.has(category as SupportCategory)) {
    return NextResponse.json({ message: 'تحقق من الاسم ورقم واتساب ونوع الطلب والتفاصيل.' }, { status: 400 })
  }
  if (!challenge || !/^\d{1,2}$/.test(answer) || Number(answer) !== challenge.first + challenge.second) {
    return NextResponse.json({ message: 'إجابة التحقق غير صحيحة أو انتهت صلاحيتها. حدّث النافذة وحاول مرة أخرى.' }, { status: 400 })
  }

  try {
    const ipHash = getIpHash(request)
    const result = await db.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ipHash}))`)
      const [recent] = await transaction.select({ total: count() })
        .from(supportTickets)
        .where(and(eq(supportTickets.ipHash, ipHash), gte(supportTickets.createdAt, new Date(Date.now() - requestWindowMs))))
      if ((recent?.total ?? 0) >= requestLimit) return { kind: 'limited' as const }

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const reference = `MSR-${randomBytes(4).toString('hex').toUpperCase()}`
        const [ticket] = await transaction.insert(supportTickets).values({
          reference,
          fullName: name,
          whatsappNumber,
          category: category as SupportCategory,
          message,
          ipHash,
          captchaNonce: challenge.nonce,
        }).onConflictDoNothing().returning({ id: supportTickets.id, reference: supportTickets.reference })
        if (ticket) return { kind: 'created' as const, reference: ticket.reference }
      }
      return { kind: 'duplicate' as const }
    })

    if (result.kind === 'limited') {
      return NextResponse.json({ message: 'وصلت إلى الحد المسموح من الطلبات. حاول مرة أخرى لاحقاً.' }, { status: 429, headers: { 'Retry-After': '3600' } })
    }
    if (result.kind === 'duplicate') return NextResponse.json({ message: 'تم استخدام سؤال التحقق. حدّث النافذة وحاول مرة أخرى.' }, { status: 409 })

    const whatsappUrl = createWhatsAppUrl(name, category as SupportCategory, message, result.reference)
    return NextResponse.json({ success: true, reference: result.reference, whatsappUrl }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[v0] Failed to create support ticket:', error)
    return NextResponse.json({ message: 'تعذّر حفظ طلبك الآن. حاول مرة أخرى.' }, { status: 500 })
  }
}
