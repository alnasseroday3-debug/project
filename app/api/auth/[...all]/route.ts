import { randomUUID } from 'node:crypto'
import { and, eq, or, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { account, session, user } from '@/lib/db/schema'
import { consumeRateLimit, getClientAddress, isRateLimitReached } from '@/lib/rate-limit'
import { isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone'
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  verifyPassword,
} from '@/lib/auth'

export const runtime = 'nodejs'

const SESSION_EXPIRATION_MS = SESSION_DURATION_SECONDS * 1_000
const AUTH_WINDOW_MS = 15 * 60_000
const MAX_AUTH_ATTEMPTS = 16

type AuthPayload = Record<string, unknown>

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  })
}

function setSessionCookie(response: NextResponse, token: string) {
  response.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${SESSION_DURATION_SECONDS}`,
  )
}

function clearSessionCookie(response: NextResponse) {
  response.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`,
  )
}

function errorDetails(error: unknown) {
  const value = error as { code?: string; constraint?: string; message?: string; cause?: { code?: string; constraint?: string; message?: string } }
  return {
    code: value?.code ?? value?.cause?.code ?? '',
    constraint: value?.constraint ?? value?.cause?.constraint ?? '',
    message: value?.message ?? value?.cause?.message ?? '',
  }
}

function serverErrorResponse(error: unknown) {
  const details = errorDetails(error)
  console.error('[auth] Request failed:', error)

  if (details.code === '23505' && /phoneNumber|username/i.test(details.constraint)) {
    return jsonResponse({ code: 'PHONE_ALREADY_EXISTS', message: 'رقم الجوال مستخدم في حساب آخر.' }, 409)
  }
  if (details.code === '23505' && /email/i.test(details.constraint)) {
    return jsonResponse({ code: 'EMAIL_ALREADY_EXISTS', message: 'البريد الإلكتروني مستخدم مسبقاً.' }, 409)
  }
  if (['08000', '08003', '08006', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(details.code)) {
    return jsonResponse({ code: 'DATABASE_UNAVAILABLE', message: 'تعذّر الاتصال بقاعدة البيانات الآن. تحقق من اتصال Neon وحاول مجدداً.' }, 503)
  }
  if (details.code === '42P01' || details.code === '42703') {
    return jsonResponse({ code: 'DATABASE_SCHEMA_ERROR', message: 'إعدادات قاعدة البيانات غير مكتملة. راجع مخطط المصادقة في Neon.' }, 500)
  }

  const reference = randomUUID().slice(0, 8)
  console.error(`[auth] Diagnostic reference ${reference}; code=${details.code || 'unknown'}`)
  return jsonResponse({ code: 'AUTH_SERVER_ERROR', message: `حدث خطأ تقني غير متوقع في الخادم. رقم التشخيص: ${reference}.` }, 500)
}

function parsePayload(value: unknown): AuthPayload | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as AuthPayload : null
}

function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizeSignupPhone(value: string) {
  const phone = normalizePhoneNumber(value)
  return phone && isValidPhoneNumber(phone) ? phone : null
}

function phoneAliases(phone: string) {
  const digits = phone.replace(/\D/g, '')
  const aliases = new Set([phone, digits])
  if (digits.startsWith('963') && digits.length === 12 && digits[3] === '9') {
    aliases.add(`0${digits.slice(3)}`)
  }
  if (/^09\d{8}$/.test(digits)) aliases.add(`963${digits.slice(1)}`)
  return [...aliases]
}

function phoneIdentifierFilter(phone: string) {
  return or(...phoneAliases(phone).flatMap((alias) => [eq(user.phoneNumber, alias), eq(user.username, alias)]))
}

function adminRoleFor(email: string) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return adminEmail && email === adminEmail ? 'admin' : 'user'
}

async function checkRateLimit(scope: string, request: NextRequest, identifier: string) {
  const identity = `${getClientAddress(request.headers)}|${identifier}`.slice(0, 512)
  try {
    if (await isRateLimitReached(scope, identity, MAX_AUTH_ATTEMPTS)) {
      return jsonResponse(
        { code: 'TOO_MANY_REQUESTS', message: 'تجاوزت عدد المحاولات المسموح. انتظر قليلاً ثم حاول مجدداً.' },
        429,
      )
    }
  } catch (error) {
    console.error('[auth] Rate limit check unavailable:', error)
  }
  return null
}

async function recordFailedAttempt(scope: string, request: NextRequest, identifier: string) {
  try {
    const identity = `${getClientAddress(request.headers)}|${identifier}`.slice(0, 512)
    await consumeRateLimit(scope, identity, MAX_AUTH_ATTEMPTS, AUTH_WINDOW_MS)
  } catch (error) {
    console.error('[auth] Failed-attempt counter unavailable:', error)
  }
}

function parseTrustedOrigin(value: string | undefined) {
  if (!value) return null
  try {
    const candidate = value.includes('://') ? value : `https://${value}`
    const url = new URL(candidate)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) return null
    return url.origin
  } catch {
    return null
  }
}

function validateRequestOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return false

  const requestOrigin = parseTrustedOrigin(origin)
  if (!requestOrigin) return false

  const trustedOrigins = new Set([request.nextUrl.origin])
  if (process.env.NODE_ENV === 'development') trustedOrigins.add('http://localhost:3000')

  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(':', '')
  for (const host of [
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim(),
    request.headers.get('host')?.trim(),
  ]) {
    const trustedOrigin = parseTrustedOrigin(host ? `${protocol}://${host}` : undefined)
    if (trustedOrigin) trustedOrigins.add(trustedOrigin)
  }

  for (const key of [
    'VERCEL_URL',
    'VERCEL_PROJECT_PRODUCTION_URL',
    'V0_RUNTIME_URL',
    'V0_DEV_APP_URL',
    'V0_BUILD_URL',
    'V0_SANDBOX_URL',
  ]) {
    const trustedOrigin = parseTrustedOrigin(process.env[key])
    if (trustedOrigin) trustedOrigins.add(trustedOrigin)
  }

  return trustedOrigins.has(requestOrigin)
}

async function createSessionForUser(userId: string) {
  const token = createSessionToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRATION_MS)

  await db.insert(session).values({
    id: randomUUID(),
    token: hashSessionToken(token),
    userId,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  })

  return { token, expiresAt }
}

async function signUp(request: NextRequest) {
  const payload = parsePayload(await request.json().catch(() => null))
  if (!payload) return jsonResponse({ code: 'INVALID_REQUEST', message: 'تعذّر قراءة بيانات التسجيل. حاول مرة أخرى.' }, 400)

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const password = typeof payload.password === 'string' ? payload.password : ''
  const rawPhone = typeof payload.phoneNumber === 'string' ? payload.phoneNumber.trim() : ''
  const phoneNumber = rawPhone ? normalizeSignupPhone(rawPhone) : null

  if (!validEmail(email)) return jsonResponse({ code: 'INVALID_EMAIL', message: 'صيغة البريد الإلكتروني غير صحيحة.' }, 400)
  if (name.length < 2 || name.length > 100) return jsonResponse({ code: 'INVALID_NAME', message: 'أدخل اسماً صحيحاً يتكون من حرفين على الأقل.' }, 400)
  if (password.length < 8) return jsonResponse({ code: 'PASSWORD_TOO_SHORT', message: 'كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.' }, 400)
  if (Buffer.byteLength(password, 'utf8') > 4_096) return jsonResponse({ code: 'PASSWORD_TOO_LONG', message: 'كلمة المرور طويلة جداً.' }, 400)
  if (rawPhone && !phoneNumber) return jsonResponse({ code: 'INVALID_PHONE_NUMBER', message: 'رقم الجوال غير صحيح. أدخل رقماً دولياً أو رقم جوال سورياً محلياً.' }, 400)

  const blocked = await checkRateLimit('signup-failure', request, `${email}|${phoneNumber ?? ''}`)
  if (blocked) return blocked

  const now = new Date()
  const userId = randomUUID()
  const token = createSessionToken()
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRATION_MS)

  try {
    if (phoneNumber) {
      const [existingPhone] = await db
        .select({ id: user.id })
        .from(user)
        .where(phoneIdentifierFilter(phoneNumber))
        .limit(1)
      if (existingPhone) {
        await recordFailedAttempt('signup-failure', request, `${email}|${phoneNumber}`)
        return jsonResponse({ code: 'PHONE_ALREADY_EXISTS', message: 'رقم الجوال مستخدم في حساب آخر.' }, 409)
      }
    }

    const [createdUser] = await db.transaction(async (tx) => {
      const [newUser] = await tx.insert(user).values({
        id: userId,
        name,
        email,
        emailVerified: false,
        phoneNumber,
        phoneNumberVerified: false,
        username: phoneNumber,
        role: adminRoleFor(email),
        createdAt: now,
        updatedAt: now,
      }).returning({ id: user.id })

      await tx.insert(account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: await hashPassword(password),
        createdAt: now,
        updatedAt: now,
      })

      await tx.insert(session).values({
        id: randomUUID(),
        token: hashSessionToken(token),
        userId,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })

      return [newUser]
    })

    if (!createdUser) throw new Error('User creation returned no row')
    const response = jsonResponse({ ok: true, userId: createdUser.id })
    setSessionCookie(response, token)
    return response
  } catch (error) {
    const details = errorDetails(error)
    if (details.code === '23505' && /phoneNumber|username/i.test(details.constraint)) {
      await recordFailedAttempt('signup-failure', request, `${email}|${phoneNumber ?? ''}`)
      return jsonResponse({ code: 'PHONE_ALREADY_EXISTS', message: 'رقم الجوال مستخدم في حساب آخر.' }, 409)
    }
    if (details.code === '23505' && /email/i.test(details.constraint)) {
      await recordFailedAttempt('signup-failure', request, `${email}|${phoneNumber ?? ''}`)
      return jsonResponse({ code: 'EMAIL_ALREADY_EXISTS', message: 'البريد الإلكتروني مستخدم مسبقاً.' }, 409)
    }
    return serverErrorResponse(error)
  }
}

async function signIn(request: NextRequest) {
  const payload = parsePayload(await request.json().catch(() => null))
  if (!payload) return jsonResponse({ code: 'INVALID_REQUEST', message: 'تعذّر قراءة بيانات الدخول. حاول مرة أخرى.' }, 400)

  const identifier = typeof payload.identifier === 'string' ? payload.identifier.trim() : ''
  const password = typeof payload.password === 'string' ? payload.password : ''
  if (!identifier || !password) return jsonResponse({ code: 'INVALID_CREDENTIALS', message: 'بيانات الدخول غير صحيحة. تحقق من البريد أو رقم الجوال وكلمة المرور.' }, 401)

  const normalizedIdentifier = identifier.toLowerCase()
  const blocked = await checkRateLimit('signin-failure', request, normalizedIdentifier)
  if (blocked) return blocked

  try {
    const isEmail = identifier.includes('@')
    const normalizedPhone = isEmail ? null : normalizePhoneNumber(identifier)
    const identityFilter = isEmail
      ? sql`lower(${user.email}) = ${normalizedIdentifier}`
      : normalizedPhone && isValidPhoneNumber(normalizedPhone)
        ? phoneIdentifierFilter(normalizedPhone)
        : sql`false`

    const [record] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
        image: user.image,
        credentialId: account.id,
        passwordHash: account.password,
      })
      .from(user)
      .innerJoin(account, and(eq(account.userId, user.id), eq(account.providerId, 'credential')))
      .where(identityFilter)
      .limit(1)

    const valid = Boolean(record?.passwordHash && await verifyPassword(password, record.passwordHash))
    if (!record || !valid) {
      await recordFailedAttempt('signin-failure', request, normalizedIdentifier)
      return jsonResponse({ code: 'INVALID_CREDENTIALS', message: 'بيانات الدخول غير صحيحة. تحقق من البريد أو رقم الجوال وكلمة المرور.' }, 401)
    }

    if (!record.passwordHash?.startsWith('bcrypt-sha256$')) {
      try {
        await db.update(account)
          .set({ password: await hashPassword(password), updatedAt: new Date() })
          .where(eq(account.id, record.credentialId))
      } catch (error) {
        console.error('[auth] Legacy password rehash failed:', error)
      }
    }

    const { token } = await createSessionForUser(record.id)
    const response = jsonResponse({ ok: true })
    setSessionCookie(response, token)
    return response
  } catch (error) {
    return serverErrorResponse(error)
  }
}

async function signOut(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const token = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1)

  if (token && /^[A-Za-z0-9_-]{40,64}$/.test(token)) {
    try {
      await db.delete(session).where(eq(session.token, hashSessionToken(token)))
    } catch (error) {
      return serverErrorResponse(error)
    }
  }

  const response = jsonResponse({ ok: true })
  clearSessionCookie(response)
  return response
}

export async function POST(request: NextRequest) {
  if (!validateRequestOrigin(request)) {
    return jsonResponse({ code: 'INVALID_ORIGIN', message: 'تعذّر التحقق من مصدر الطلب. حدّث الصفحة ثم حاول مجدداً.' }, 403)
  }

  const path = request.nextUrl.pathname
  try {
    if (path === '/api/auth/sign-up') return await signUp(request)
    if (path === '/api/auth/sign-in') return await signIn(request)
    if (path === '/api/auth/sign-out') return await signOut(request)
    return jsonResponse({ code: 'NOT_FOUND', message: 'المسار غير موجود.' }, 404)
  } catch (error) {
    return serverErrorResponse(error)
  }
}

export async function GET() {
  return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'هذه العملية غير متاحة.' }, 405)
}
