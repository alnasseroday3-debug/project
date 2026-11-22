import { and, desc, eq, gt, gte, ilike, lte, or, sql } from 'drizzle-orm'
import { type ListingCategory, isListingCategory } from '@/lib/listing-categories'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { carListings, userFollows } from '@/lib/db/schema'
import { optionalSocialUser } from '@/lib/social/api'

export const dynamic = 'force-dynamic'

const pageSize = 12
const searchSynonymGroups: { aliases: string[]; categories?: ListingCategory[] }[] = [
  { aliases: ['kia', 'كيا'] },
  { aliases: ['toyota', 'تويوتا'] },
  { aliases: ['hyundai', 'هيونداي', 'هيونداى'] },
  { aliases: ['mercedes', 'مرسيدس', 'مرسيدس بنز'] },
  { aliases: ['iphone', 'آيفون', 'ايفون', 'أيفون', 'ابل', 'أبل'] },
  { aliases: ['samsung', 'سامسونج', 'سامسونغ'] },
  { aliases: ['laptop', 'لابتوب', 'حاسوب محمول'] },
  { aliases: ['apartment', 'apartments', 'flat', 'شقة', 'شقق'], categories: ['real_estate'] },
  { aliases: ['car', 'cars', 'vehicle', 'vehicles', 'سيارة', 'سيارات', 'مركبة', 'مركبات'], categories: ['cars'] },
  { aliases: ['real', 'estate', 'property', 'properties', 'عقار', 'عقارات', 'منزل', 'منازل'], categories: ['real_estate'] },
  { aliases: ['furniture', 'أثاث', 'مفروشات'], categories: ['furniture'] },
  { aliases: ['appliance', 'appliances', 'أجهزة كهربائية', 'أدوات كهربائية'], categories: ['appliances'] },
  { aliases: ['electronics', 'electronic', 'إلكترونيات', 'الكترونيات', 'أجهزة إلكترونية'], categories: ['electronics'] },
  { aliases: ['fashion', 'clothes', 'clothing', 'ملابس', 'أحذية'], categories: ['fashion'] },
]
const normalizeSearchTerm = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '')
const searchSynonyms = new Map<string, { aliases: string[]; categories?: ListingCategory[] }>()
for (const group of searchSynonymGroups) {
  for (const alias of group.aliases) searchSynonyms.set(normalizeSearchTerm(alias), group)
}
const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, '\\$&')
const searchableListingText = sql`concat_ws(' ', ${carListings.make}, ${carListings.model}, ${carListings.city}, ${carListings.description}, ${carListings.details}::text, CASE ${carListings.category} WHEN 'cars' THEN 'السيارات والمركبات cars' WHEN 'real_estate' THEN 'العقارات والمنازل real estate' WHEN 'furniture' THEN 'الأثاث المنزلي furniture' WHEN 'appliances' THEN 'الأدوات الكهربائية appliances' WHEN 'electronics' THEN 'الأجهزة الإلكترونية electronics' WHEN 'fashion' THEN 'الملابس والأحذية fashion' ELSE '' END)`

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
  const viewer = await optionalSocialUser()
  const followedSeller = viewer
    ? sql<boolean>`EXISTS (SELECT 1 FROM user_follows WHERE follower_id = ${viewer.id} AND followed_id = ${carListings.userId})`
    : sql<boolean>`false`
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
    eq(carListings.hiddenByOwner, false),
    gt(carListings.expiresAt, new Date()),
  ]

  if (category !== 'all') filters.push(eq(carListings.category, category))
  if (governorate) filters.push(eq(carListings.city, governorate))
  if (query) {
    const terms = [...new Set(query.split(/[^\p{L}\p{N}+#]+/u).map(normalizeSearchTerm).filter(Boolean))]
    for (const term of terms) {
      const synonymGroup = searchSynonyms.get(term)
      const aliases = synonymGroup?.aliases ?? [term]
      const matches = [
        ...aliases.map((alias) => ilike(searchableListingText, `%${escapeLikePattern(alias)}%`)),
        ...(synonymGroup?.categories ?? []).map((value) => eq(carListings.category, value)),
      ]
      filters.push(or(...matches)!)
    }
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
      followedSeller,
    })
    .from(carListings)
    .where(and(...filters))
    .orderBy(...(viewer ? [desc(followedSeller)] : []), sql`${carListings.publishedAt} DESC NULLS LAST`, desc(carListings.createdAt))
    .limit(pageSize + 1)
    .offset(offset)

  const hasMore = rows.length > pageSize
  return NextResponse.json({ items: hasMore ? rows.slice(0, pageSize) : rows, hasMore, pageSize, offset })
}
