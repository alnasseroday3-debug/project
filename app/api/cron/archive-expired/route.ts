import { NextResponse, type NextRequest } from 'next/server'
import { archiveExpiredListings } from '@/lib/listing-lifecycle'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  await archiveExpiredListings()
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}
