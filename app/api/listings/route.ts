import { and, desc, eq, gt, gte, ilike, lte, or, sql } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'
import { isListingCategory } from '@/lib/listing-categories'

export const dynamic = 'force-dynamic'

const pageSize = 12
const brandAliases: Record<string, string[]> = {
  kia: ['Kia', 'كيا'],
  hyundai: ['Hyundai', 'هيونداي', 'هيونداى'],
  toyota: ['Toyota', 'تويوتا'],
  mercedes: ['Mercedes', 'مرسيدس', 'مرسيدس بنز'],
  chery: ['Chery', 'شيري'],
  peugeot: ['Peugeot', 'بيجو'],
  chevrolet: ['Chevrolet', 'شيفروليه', 'شفروليه'],
  nissan: ['Nissan', 'نيسان'],
  bmw: ['BMW', 'بي ام دبليو', 'بي إم دبليو'],
  audi: ['Audi', 'أودي', 'اودي'],
}

function numberParameter(value: string | null, minimum: number, maximum: number) {
  if (!value || !/^\d+$/.test(value)) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const requestedCategory = params.get('category') ?? 'all'
  const category = requestedCategory === 'all' || isListingCategory(requestedCategory) ? requestedCategory : 'all'
  const query = (params.get('q') ?? '').normalize('NFKC').trim().slice(0, 100)
  const governorate = (params.get('governorate') ?? '').normalize('NFKC').trim().slice(0, 60)
  const period = params.get('period')
  const condition = params.get('condition')
  const brand = params.get('brand')
  const minPrice = numberParameter(params.get('minPrice'), 1, 100_000_000)
  const maxPrice = numberParameter(params.get('maxPrice'), 1, 100_000_000)
  const offset = numberParameter(params.get('offset'), 0, 100_000) ?? 0
  const filters = [
    eq(carListings.status, 'approved'),
    gt(carListings.expiresAt, new Date()),
  ]

  if (category !== 'all') filters.push(eq(carListings.category, category))
  if (governorate) filters.push(eq(carListings.city, governorate))
  if (query) {
    const pattern = `%${query}%`
    filters.push(or(
      ilike(carListings.make, pattern),
      ilike(carListings.model, pattern),
      ilike(carListings.city, pattern),
      sql`${carListings.details}->>'district' ILIKE ${pattern}`,
    )!)
  }
  if (period && ['week', 'month', 'year'].includes(period)) {
    const cutoff = new Date()
    if (period === 'week') cutoff.setDate(cutoff.getDate() - 7)
    if (period === 'month') cutoff.setMonth(cutoff.getMonth() - 1)
    if (period === 'year') cutoff.setFullYear(cutoff.getFullYear() - 1)
    filters.push(gte(carListings.publishedAt, cutoff))
  }
  if ((condition === 'new' || condition === 'used') && category === 'cars') {
    filters.push(eq(carListings.condition, condition))
  }
  if (brand && brandAliases[brand] && category === 'cars') {
    filters.push(or(...brandAliases[brand].map((alias) => ilike(carListings.make, alias)))!)
  }
  if (minPrice !== null) filters.push(gte(carListings.askingPrice, minPrice))
  if (maxPrice !== null) filters.push(lte(carListings.askingPrice, maxPrice))

  const rows = await db
    .select({
      id: carListings.id,
      make: carListings.make,
      model: carListings.model,
      category: carListings.category,
      details: carListings.details,
      year: carListings.year,
      condition: carListings.condition,
      mileage: carListings.mileage,
      mileageUnknown: carListings.mileageUnknown,
      askingPrice: carListings.askingPrice,
      negotiable: carListings.negotiable,
      negotiationMin: carListings.negotiationMin,
      negotiationMax: carListings.negotiationMax,
      transmission: carListings.transmission,
      paintCondition: carListings.paintCondition,
      city: carListings.city,
      images: carListings.images,
      verified: carListings.verified,
      publishedAt: carListings.publishedAt,
    })
    .from(carListings)
    .where(and(...filters))
    .orderBy(desc(carListings.publishedAt))
    .limit(pageSize + 1)
    .offset(offset)

  const hasMore = rows.length > pageSize
  return NextResponse.json({ items: hasMore ? rows.slice(0, pageSize) : rows, hasMore, pageSize, offset })
}
