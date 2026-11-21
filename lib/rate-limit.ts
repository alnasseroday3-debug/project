import { createHmac } from 'node:crypto'
import { lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { rateLimits } from '@/lib/db/schema'

export function getClientAddress(headers: Headers) {
  return headers.get('x-real-ip')?.trim() || headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

function rateLimitKey(scope: string, identity: string) {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('Rate-limit signing secret is not configured.')
  const fingerprint = createHmac('sha256', secret).update(identity.slice(0, 512)).digest('hex')
  return `${scope}:${fingerprint}`
}

export async function consumeRateLimit(scope: string, identity: string, maximum: number, windowMs: number) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + windowMs)
  const key = rateLimitKey(scope, identity || 'unknown')
  const [record] = await db
    .insert(rateLimits)
    .values({ key, count: 1, expiresAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.expiresAt} <= ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} <= ${now} THEN ${expiresAt} ELSE ${rateLimits.expiresAt} END`,
      },
    })
    .returning({ count: rateLimits.count })

  await db.delete(rateLimits).where(lte(rateLimits.expiresAt, now))
  return (record?.count ?? maximum + 1) <= maximum
}
