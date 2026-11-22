import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentSession, isAdminEmail } from '@/lib/auth-helpers'
import { consumeRateLimit } from '@/lib/rate-limit'

export type SocialUser = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>['user']

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin) return origin === request.nextUrl.origin
  const referer = request.headers.get('referer')
  try { return Boolean(referer && new URL(referer).origin === request.nextUrl.origin) } catch { return false }
}

export async function requireSocialUser(request: NextRequest): Promise<{ user: SocialUser; response: null } | { user: null; response: NextResponse }> {
  if (!isSameOrigin(request)) return { user: null, response: jsonError('الطلب غير صالح.', 403) }
  const session = await getCurrentSession()
  if (!session?.user) return { user: null, response: jsonError('سجّل الدخول للمتابعة.', 401) }
  return { user: session.user, response: null }
}

export async function optionalSocialUser() {
  return (await getCurrentSession())?.user ?? null
}

export function socialText(value: unknown, maximum: number) {
  if (typeof value !== 'string') return ''
  return value.normalize('NFKC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maximum)
}

export function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value)
}

export function isSocialAdmin(user: SocialUser) {
  return isAdminEmail(user.email, user.emailVerified, user.role)
}

export async function socialRateLimited(scope: string, userId: string, maximum: number, windowMs = 60_000) {
  return !(await consumeRateLimit(`social:${scope}`, userId, maximum, windowMs))
}

export function validBase64(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
}
