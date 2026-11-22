import { NextResponse } from 'next/server'
import { archiveExpiredListings } from '@/lib/listing-lifecycle'

export const dynamic = 'force-dynamic'

export async function GET() {
  await archiveExpiredListings()
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}
