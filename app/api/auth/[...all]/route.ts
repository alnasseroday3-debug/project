import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { consumeRateLimit, getClientAddress } from '@/lib/rate-limit'
import { toNextJsHandler } from 'better-auth/next-js'

const authHandlers = toNextJsHandler(auth)
export const GET = authHandlers.GET

export async function POST(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isSignIn = /^\/api\/auth\/sign-in\/(email|username)$/.test(path)
  const isSignUp = path === '/api/auth/sign-up/email'
  if (!isSignIn && !isSignUp) return authHandlers.POST(request)

  try {
    let identifier = ''
    try {
      const body: unknown = await request.clone().json()
      if (body && typeof body === 'object') {
        const values = body as Record<string, unknown>
        const rawIdentifier = values.email ?? values.username
        identifier = typeof rawIdentifier === 'string' ? rawIdentifier.trim().toLowerCase().slice(0, 160) : ''
      }
    } catch {
      identifier = ''
    }

    const address = getClientAddress(request.headers)
    const limits = await Promise.all([
      consumeRateLimit(isSignUp ? 'signup-ip' : 'signin-ip', address, isSignUp ? 8 : 30, isSignUp ? 60 * 60_000 : 15 * 60_000),
      ...(identifier
        ? [consumeRateLimit(isSignUp ? 'signup-identity' : 'signin-identity', identifier, isSignUp ? 5 : 6, isSignUp ? 60 * 60_000 : 15 * 60_000)]
        : []),
    ])

    if (limits.some((allowed) => !allowed)) {
      return NextResponse.json({ message: 'تجاوزت عدد المحاولات المسموح. حاول لاحقاً.' }, { status: 429 })
    }
    return authHandlers.POST(request)
  } catch (error) {
    console.error('[v0] Authentication rate limit unavailable:', error)
    return NextResponse.json({ message: 'تعذّر التحقق من الطلب. حاول مرة أخرى.' }, { status: 503 })
  }
}
