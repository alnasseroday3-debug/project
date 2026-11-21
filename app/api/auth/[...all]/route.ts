import { NextResponse, type NextRequest } from 'next/server'
import { eq, ilike, or } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { consumeRateLimit, getClientAddress, isRateLimitReached } from '@/lib/rate-limit'
import { isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone'
import { toNextJsHandler } from 'better-auth/next-js'

const authHandlers = toNextJsHandler(auth)
export const GET = authHandlers.GET

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ code, message }, { status })
}

function forwardJson(request: NextRequest, body: Record<string, unknown>) {
  const headers = new Headers(request.headers)
  headers.delete('content-length')
  headers.set('content-type', 'application/json')
  return new Request(request.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

async function recordFailedAttempt(scope: string, identity: string) {
  try {
    await consumeRateLimit(scope, identity, 16, 15 * 60_000)
  } catch (error) {
    console.error('[v0] Authentication failure counter unavailable:', error)
  }
}

export async function POST(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isSignIn = /^\/api\/auth\/sign-in\/(email|username)$/.test(path)
  const isSignUp = path === '/api/auth/sign-up/email'
  if (!isSignIn && !isSignUp) return authHandlers.POST(request)

  let body: Record<string, unknown> | undefined
  try {
    const parsed: unknown = await request.clone().json()
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>
    }
  } catch {
    body = undefined
  }

  let identifier = ''
  let signUpEmail = ''
  let signUpPhone = ''
  let authRequest: Request = request

  if (isSignUp) {
    if (!body) return errorResponse('INVALID_REQUEST', 'تعذّر قراءة بيانات التسجيل. حاول مرة أخرى.', 400)

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const rawPhone = typeof body.phoneNumber === 'string'
      ? body.phoneNumber
      : typeof body.username === 'string'
        ? body.username
        : ''
    const normalizedPhone = rawPhone.trim() ? normalizePhoneNumber(rawPhone) : ''

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse('INVALID_EMAIL', 'صيغة البريد الإلكتروني غير صحيحة.', 400)
    }
    if (password.length < 8) {
      return errorResponse('PASSWORD_TOO_SHORT', 'كلمة المرور قصيرة جداً؛ يجب أن تتكون من 8 أحرف على الأقل.', 400)
    }
    if (password.length > 128) {
      return errorResponse('PASSWORD_TOO_LONG', 'كلمة المرور أطول من الحد المسموح.', 400)
    }
    if (name.length < 2 || name.length > 100) {
      return errorResponse('INVALID_NAME', 'أدخل اسماً صحيحاً يتكون من حرفين على الأقل.', 400)
    }
    if (normalizedPhone && !isValidPhoneNumber(normalizedPhone)) {
      return errorResponse('INVALID_PHONE_NUMBER', 'رقم الجوال غير صحيح. أدخل رقماً دولياً صالحاً.', 400)
    }

    signUpEmail = email
    signUpPhone = normalizedPhone
    identifier = `${email}|${normalizedPhone}`
    const sanitizedBody: Record<string, unknown> = { ...body, email, name }
    delete sanitizedBody.phoneNumber
    delete sanitizedBody.username
    if (normalizedPhone) {
      sanitizedBody.phoneNumber = normalizedPhone
      sanitizedBody.username = normalizedPhone
    }
    authRequest = forwardJson(request, sanitizedBody)
  } else if (body) {
    const rawIdentifier = body.email ?? body.username
    identifier = typeof rawIdentifier === 'string' ? rawIdentifier.trim().toLowerCase().slice(0, 160) : ''
  }

  const address = getClientAddress(request.headers).slice(0, 160)
  const rateIdentity = `${address}|${identifier}`.slice(0, 512)
  const rateScope = isSignUp ? 'signup-failure' : 'signin-failure'

  if (identifier) {
    try {
      if (await isRateLimitReached(rateScope, rateIdentity, 16)) {
        return NextResponse.json(
          { code: 'TOO_MANY_REQUESTS', message: 'تجاوزت عدد المحاولات الفاشلة المسموح. انتظر قليلاً ثم حاول مجدداً.' },
          { status: 429, headers: { 'Retry-After': '900' } },
        )
      }
    } catch (error) {
      console.error('[v0] Authentication rate limit check unavailable:', error)
    }
  }

  if (isSignUp) {
    try {
      const [existingEmail] = await db
        .select({ id: user.id })
        .from(user)
        .where(ilike(user.email, signUpEmail))
        .limit(1)

      if (existingEmail) {
        await recordFailedAttempt(rateScope, rateIdentity)
        return errorResponse('EMAIL_ALREADY_EXISTS', 'البريد الإلكتروني مستخدم مسبقاً.', 409)
      }

      if (signUpPhone) {
        const [existingPhone] = await db
          .select({ id: user.id })
          .from(user)
          .where(or(eq(user.phoneNumber, signUpPhone), eq(user.username, signUpPhone)))
          .limit(1)

        if (existingPhone) {
          await recordFailedAttempt(rateScope, rateIdentity)
          return errorResponse('PHONE_ALREADY_EXISTS', 'رقم الجوال هذا مسجل بحساب آخر.', 409)
        }
      }
    } catch (error) {
      console.error('[v0] Sign-up availability check failed:', error)
      return errorResponse('SIGN_UP_TEMPORARILY_UNAVAILABLE', 'تعذّر التحقق من البيانات الآن. حاول مرة أخرى بعد قليل.', 503)
    }
  }

  let response: Response
  try {
    response = await authHandlers.POST(authRequest)
  } catch (error) {
    console.error('[v0] Authentication request failed:', error)
    if (identifier) await recordFailedAttempt(rateScope, rateIdentity)
    return errorResponse('AUTH_TEMPORARILY_UNAVAILABLE', 'تعذّر إكمال الطلب الآن. حاول مرة أخرى بعد قليل.', 503)
  }

  if (!response.ok && identifier) await recordFailedAttempt(rateScope, rateIdentity)

  if (isSignUp && !response.ok) {
    try {
      const [existingEmail] = await db
        .select({ id: user.id })
        .from(user)
        .where(ilike(user.email, signUpEmail))
        .limit(1)
      if (existingEmail) {
        return errorResponse('EMAIL_ALREADY_EXISTS', 'البريد الإلكتروني مستخدم مسبقاً.', 409)
      }

      if (signUpPhone) {
        const [existingPhone] = await db
          .select({ id: user.id })
          .from(user)
          .where(or(eq(user.phoneNumber, signUpPhone), eq(user.username, signUpPhone)))
          .limit(1)
        if (existingPhone) {
          return errorResponse('PHONE_ALREADY_EXISTS', 'رقم الجوال هذا مسجل بحساب آخر.', 409)
        }
      }
    } catch (error) {
      console.error('[v0] Sign-up conflict recheck failed:', error)
    }
  }

  return response
}
