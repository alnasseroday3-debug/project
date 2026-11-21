import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { eq, ilike, or } from 'drizzle-orm'
import { username } from 'better-auth/plugins'
import { pool, db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone'

function toOrigin(value?: string) {
  if (!value) return undefined
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).origin
  } catch {
    return undefined
  }
}

const vercelOrigins = [
  toOrigin(process.env.VERCEL_URL),
  toOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
].filter((origin): origin is string => Boolean(origin))

const previewOrigins = [
  process.env.V0_RUNTIME_URL,
  process.env.V0_DEV_APP_URL,
  process.env.V0_BUILD_URL,
  process.env.V0_SANDBOX_URL,
].map(toOrigin).filter((origin): origin is string => Boolean(origin))

const configuredAuthOrigin = toOrigin(process.env.BETTER_AUTH_URL)
const trustedOrigins = [...new Set([
  ...(configuredAuthOrigin ? [configuredAuthOrigin] : []),
  ...vercelOrigins,
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', ...previewOrigins] : []),
])]

const baseURL =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.V0_RUNTIME_URL ??
        process.env.V0_DEV_APP_URL ??
        process.env.V0_BUILD_URL ??
        process.env.V0_SANDBOX_URL ??
        (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined))

const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()

export const auth = betterAuth({
  database: pool,
  baseURL,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  user: {
    additionalFields: {
      phoneNumber: {
        type: 'string',
        required: false,
        input: true,
      },
      phoneNumberVerified: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: false,
      },
      role: {
        type: ['user', 'admin'],
        required: false,
        defaultValue: 'user',
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          const email = newUser.email.trim().toLowerCase()
          const phoneNumber = typeof newUser.phoneNumber === 'string'
            ? normalizePhoneNumber(newUser.phoneNumber)
            : ''
          const usernameValue = typeof newUser.username === 'string'
            ? normalizePhoneNumber(newUser.username)
            : phoneNumber

          if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
            throw new APIError('BAD_REQUEST', {
              code: 'INVALID_PHONE_NUMBER',
              message: 'رقم الجوال غير صحيح.',
            })
          }

          const [existingEmail] = await db
            .select({ id: user.id })
            .from(user)
            .where(ilike(user.email, email))
            .limit(1)

          if (existingEmail) {
            throw new APIError('BAD_REQUEST', {
              code: 'EMAIL_ALREADY_EXISTS',
              message: 'البريد الإلكتروني مستخدم مسبقاً.',
            })
          }

          if (phoneNumber) {
            const [existingPhone] = await db
              .select({ id: user.id })
              .from(user)
              .where(or(eq(user.phoneNumber, phoneNumber), eq(user.username, phoneNumber)))
              .limit(1)

            if (existingPhone) {
              throw new APIError('BAD_REQUEST', {
                code: 'PHONE_ALREADY_EXISTS',
                message: 'رقم الجوال هذا مسجل بحساب آخر.',
              })
            }
          }

          const normalizedEmail = email
          const isAdmin = Boolean(adminEmail && normalizedEmail === adminEmail)
          const normalizedPhone = phoneNumber || null

          return {
            data: {
              ...newUser,
              email: normalizedEmail,
              phoneNumber: normalizedPhone,
              phoneNumberVerified: false,
              username: normalizedPhone ?? (usernameValue || null),
              role: isAdmin ? 'admin' : 'user',
            },
          }
        },
      },
    },
  },
  plugins: [
    username({
      displayUsername: false,
      usernameValidator: (value) => /^\+?[1-9]\d{7,14}$/.test(value),
      usernameNormalization: (value) => normalizePhoneNumber(value),
    }),
  ],
  trustedOrigins: async (request) => {
    if (!request) return trustedOrigins
    const requestOrigin = toOrigin(request.url)
    return requestOrigin ? [...new Set([...trustedOrigins, requestOrigin])] : trustedOrigins
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})
