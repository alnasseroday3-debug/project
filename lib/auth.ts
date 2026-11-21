import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { session as sessionTable, user } from '@/lib/db/schema'

export const SESSION_COOKIE_NAME = '__Host-masar_session'
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7

export type AuthUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  role: string
  image: string | null
}

type HeaderReader = { get(name: string): string | null }

function digestPassword(password: string) {
  return createHash('sha256')
    .update('masar-password-v1\0')
    .update(password.normalize('NFKC'))
    .digest('hex')
}

export async function hashPassword(password: string) {
  return `bcrypt-sha256$${await bcrypt.hash(digestPassword(password), 12)}`
}

function verifyLegacyScrypt(password: string, storedHash: string) {
  const [salt, encodedKey, extra] = storedHash.split(':')
  if (extra || !salt || !encodedKey || !/^[a-f\d]{128}$/i.test(encodedKey) || !/^[A-Za-z0-9+/_=-]{16,64}$/.test(salt)) {
    return Promise.resolve(false)
  }

  return new Promise<boolean>((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      64,
      { N: 16_384, r: 16, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, derivedKey) => {
        if (error) {
          reject(error)
          return
        }
        const expected = Buffer.from(encodedKey, 'hex')
        resolve(expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey))
      },
    )
  })
}

export async function verifyPassword(password: string, storedHash: string) {
  if (storedHash.startsWith('bcrypt-sha256$')) {
    return bcrypt.compare(digestPassword(password), storedHash.slice('bcrypt-sha256$'.length))
  }
  return verifyLegacyScrypt(password, storedHash)
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function readSessionToken(headers: HeaderReader) {
  const cookieHeader = headers.get('cookie')
  if (!cookieHeader) return null

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0 || part.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue
    const token = part.slice(separator + 1).trim()
    return /^[A-Za-z0-9_-]{40,64}$/.test(token) ? token : null
  }

  return null
}

function roleForSession(email: string, storedRole: string) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return adminEmail && email.trim().toLowerCase() === adminEmail ? 'admin' : storedRole
}

async function getSession({ headers }: { headers: HeaderReader }) {
  const token = readSessionToken(headers)
  if (!token) return null

  const [record] = await db
    .select({
      id: sessionTable.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      image: user.image,
      expiresAt: sessionTable.expiresAt,
    })
    .from(sessionTable)
    .innerJoin(user, eq(sessionTable.userId, user.id))
    .where(and(eq(sessionTable.token, hashSessionToken(token)), gt(sessionTable.expiresAt, new Date())))
    .limit(1)

  if (!record) return null

  return {
    session: {
      id: record.id,
      userId: record.userId,
      expiresAt: record.expiresAt,
    },
    user: {
      id: record.userId,
      name: record.name,
      email: record.email,
      emailVerified: record.emailVerified,
      role: roleForSession(record.email, record.role),
      image: record.image,
    } satisfies AuthUser,
  }
}

export const auth = {
  api: {
    getSession,
  },
}
