import { ilike, or } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { optionalSocialUser, socialRateLimited, socialText } from '@/lib/social/api'
import { getClientAddress } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

export async function GET(request: NextRequest) {
  const query = socialText(request.nextUrl.searchParams.get('q'), 80)
  if (query.length < 2) return NextResponse.json({ users: [] }, { headers: { 'Cache-Control': 'no-store' } })
  const currentUser = await optionalSocialUser()
  const identity = currentUser?.id ?? getClientAddress(request.headers)
  if (await socialRateLimited('profile-search', identity, 40)) return NextResponse.json({ error: 'تم تجاوز عدد محاولات البحث.' }, { status: 429, headers: { 'Cache-Control': 'no-store' } })
  const pattern = `%${escapeLike(query)}%`
  const users = await db.select({ id: user.id, name: user.name, username: user.username, image: user.image, governorate: user.governorate })
    .from(user)
    .where(or(ilike(user.name, pattern), ilike(user.username, pattern)))
    .limit(20)
  return NextResponse.json({ users: users.filter((person) => person.id !== currentUser?.id) }, { headers: { 'Cache-Control': 'no-store' } })
}
