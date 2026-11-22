import { lt, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { socialMessages } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  const expired = await db.delete(socialMessages).where(lt(socialMessages.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))).returning({ id: socialMessages.id })
  await db.execute(sql`
    DELETE FROM social_messages
    WHERE id IN (
      SELECT id FROM (
        SELECT id, row_number() OVER (PARTITION BY conversation_id ORDER BY created_at DESC, id DESC) AS position
        FROM social_messages
      ) ranked
      WHERE ranked.position > 200
    )
  `)
  return NextResponse.json({ success: true, expiredDeleted: expired.length }, { headers: { 'Cache-Control': 'no-store' } })
}
