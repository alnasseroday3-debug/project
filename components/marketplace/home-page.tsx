'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import useSWRInfinite from 'swr/infinite'
import {
  Armchair,
  ArrowLeft,
  ArrowUpLeft,
  BadgeCheck,
  CarFront,
  CircleHelp,
  Clock3,
  Gauge,
  House,
  MapPin,
  PlugZap,
  RotateCcw,
  Search,
  ShieldCheck,
  Shirt,
  Smartphone,
  Tag,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CarPhoto } from '@/components/marketplace/car-photo'
import { ListingSocialActions } from '@/components/social/listing-social-actions'
import { CategoryGrid } from '@/components/marketplace/category-grid'
import type { PublicCarListing } from '@/lib/db/schema'
import { carImageUrl } from '@/lib/car-image-url'
import { listingAgeLabel } from '@/lib/listing-age'
import { listingCategoryLabels, type ListingCategory } from '@/lib/listing-categories'
import { syrianGovernorates } from '@/lib/user-preferences'

type HomeListing = PublicCarListing & {
  negotiationMin: number | null
  negotiationMax: number | null
  transmission?: string | null
  paintCondition?: string | null
  publishedAt: Date | string | null
  followedSeller?: boolean
}

type ListingsPage = { items: HomeListing[]; hasMore: boolean; pageSize: number; offset: number }

const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const brands = [
  { label: 'كيا', value: 'kia' }, { label: 'هيونداي', value: 'hyundai' },
  { label: 'تويوتا', value: 'toyota' }, { label: 'مرسيدس', value: 'mercedes' },
  { label: 'شيري', value: 'chery' }, { label: 'بيجو', value: 'peugeot' },
  { label: 'شيفروليه', value: 'chevrolet' }, { label: 'نيسان', value: 'nissan' },
  { label: 'BMW', value: 'bmw' }, { label: 'أودي', value: 'audi' },
]
const categoryIcons: Record<ListingCategory, LucideIcon> = {
  cars: CarFront,
  real_estate: House,
  furniture: Armchair,
  appliances: PlugZap,
  electronics: Smartphone,
  fashion: Shirt,
}

async function fetchListings(url: string): Promise<ListingsPage> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('تعذّر تحميل الإعلانات.')
  return response.json()
}

function conditionLabel(listing: HomeListing) {
  const value = listing.details?.condition
  if (value) return value
  if (listing.category === 'cars') return listing.condition === 'new' ? 'جديدة' : 'مستعملة'
  return ''
}

function ListingCard({ listing, isAuthenticated }: { listing: HomeListing; isAuthenticated: boolean }) {
  const category = listing.category ?? 'cars'
  const isCar = category === 'cars'
  const title = isCar ? [listing.make, listing.model].filter(Boolean).join(' ') : listing.make || listing.model
  const detailBadges = [listing.details?.itemType, listing.details?.brand, listing.details?.size].filter(Boolean)
  const CategoryIcon = categoryIcons[category]
  const photo = carImageUrl(listing)

  return (
    <article className="listing-card marketplace-listing-card">
      <Link className="listing-image-link" href={`/cars/${listing.id}`} aria-label={`عرض ${title}`}>
        <CarPhoto src={photo} alt={title || 'صورة الإعلان'} width={720} height={480} className="listing-image" />
        {conditionLabel(listing) && <span className="condition-badge">{conditionLabel(listing)}</span>}
        <span className="listing-age-badge">{listingAgeLabel(listing.publishedAt ? new Date(listing.publishedAt) : null)}</span>
        <span className="image-arrow"><ArrowUpLeft aria-hidden="true" /></span>
      </Link>
      <div className="listing-content">
        <div className="listing-title-row">
          <div>
            <span className="listing-make">{isCar ? listing.make : listingCategoryLabels[category]}</span>
            <h3>{isCar ? listing.model : title}</h3>
          </div>
          {isCar && <span className="listing-year">{listing.year}</span>}
        </div>
        <div className="listing-badges" aria-label="معلومات الإعلان">
          {listing.verified && <span className="verified-pill"><BadgeCheck aria-hidden="true" /> موثق من مَسَار</span>}
          {listing.followedSeller && <span className="social-followed-badge">من متابَعيك</span>}
          {listing.negotiable && <span className="listing-info-badge is-negotiable"><Tag aria-hidden="true" /> قابل للتفاوض</span>}
          {isCar && listing.transmission && (
            <span className="listing-info-badge">
              <CarFront aria-hidden="true" />{' '}
              {listing.transmission === 'automatic' ? 'أوتوماتيك' : listing.transmission === 'manual' ? 'عادي' : listing.transmission}
            </span>
          )}
          {!isCar && detailBadges.map((badge) => <span className="listing-info-badge" key={badge}><CategoryIcon aria-hidden="true" /> {badge}</span>)}
        </div>
        <div className="listing-meta">
          {isCar && <span><Gauge aria-hidden="true" />{listing.mileageUnknown ? 'العداد متوقف / لا أعلم' : `${money.format(listing.mileage)} كم`}</span>}
          {!isCar && listing.details?.areaSqm && <span><House aria-hidden="true" />{listing.details.areaSqm} م²</span>}
          {listing.city && <span><MapPin aria-hidden="true" />{[listing.city, listing.details?.district].filter(Boolean).join('، ')}</span>}
        </div>
        <div className="listing-price-row">
          <p className="listing-price" dir="ltr"><strong>${money.format(listing.askingPrice)}</strong></p>
        </div>
        <ListingSocialActions listingId={listing.id} isAuthenticated={isAuthenticated} compact />
        <Link className="listing-details-button" href={`/cars/${listing.id}`} aria-label={`عرض تفاصيل ${title}`}>
          عرض التفاصيل <ArrowLeft aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}

export function HomePage({ initialPage, isAuthenticated }: { initialPage: ListingsPage; isAuthenticated: boolean }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | ListingCategory>('all')
  const [governorate, setGovernorate] = useState('')
  const [condition, setCondition] = useState<'all' | 'new' | 'used'>('all')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [publicationPeriod, setPublicationPeriod] = useState<'all' | 'week' | 'month' | 'year'>('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  // إظهار الإعلانات والفلاتر فقط عند اختيار قسم أو كتابة بحث
  const isBrowsing =
    category !== 'all' ||
    Boolean(query.trim()) ||
    Boolean(governorate) ||
    publicationPeriod !== 'all' ||
    Boolean(minPrice) ||
    Boolean(maxPrice)

  const defaultFilters =
    category === 'all' &&
    !query &&
    !governorate &&
    condition === 'all' &&
    selectedBrand === 'all' &&
    publicationPeriod === 'all' &&
    !minPrice &&
    !maxPrice

  const getKey = (pageIndex: number, previousPage: ListingsPage | null) => {
    if (!isBrowsing) return null
    if (pageIndex > 0 && !previousPage?.hasMore) return null
    const params = new URLSearchParams({ offset: String(pageIndex * 12), limit: '12', category })
    if (query.trim()) params.set('q', query.trim())
    if (governorate) params.set('governorate', governorate)
    if (publicationPeriod !== 'all') params.set('period', publicationPeriod)
    if (category === 'cars') {
      if (condition !== 'all') params.set('condition', condition)
      if (selectedBrand !== 'all') params.set('brand', selectedBrand)
    }
    if (minPrice) params.set('minPrice', minPrice)
    if (maxPrice) params.set('maxPrice', maxPrice)
    return `/api/listings?${params.toString()}`
  }

  const { data, size, setSize, isLoading, isValidating, error } = useSWRInfinite<ListingsPage>(getKey, fetchListings, {
    fallbackData: defaultFilters ? [initialPage] : undefined,
    persistSize: false,
    revalidateFirstPage: false,
  })

  const listings = useMemo(
    () => (data ? data.flatMap((page) => page.items) : defaultFilters ? initialPage.items : []),
    [data, defaultFilters, initialPage.items]
  )
  const hasMore = data?.[data.length - 1]?.hasMore ?? (defaultFilters && initialPage.hasMore)
  const loadedCount = listings.length

  function selectCategory(nextCategory: ListingCategory) {
    setCategory(nextCategory)
    setSelectedBrand('all')
    setCondition('all')
    if (nextCategory !== 'cars') {
      setMinPrice('')
      setMaxPrice('')
    }
  }

  function resetAllFilters() {
    setQuery('')
    setCategory('all')
    setGovernorate('')
    setCondition('all')
    setSelectedBrand('all')
    setPublicationPeriod('all')
    setMinPrice('')
    setMaxPrice('')
  }

  return (
    <main className="marketplace-home">
      <section className="marketplace-hero-section page-container" aria-labelledby="marketplace-title">
        <div className="marketplace-hero-frame">
          <span className="marketplace-hero-kicker"><span className="eyebrow-dot" /> مَسار · سوق سوريا الشامل</span>
          <h1 id="marketplace-title">كل شيء تريده في مكان واحد.</h1>
          <p>اكتشف ما تحتاجه في سوق سوريا — بخطوات واضحة وتواصل مباشر.</p>
          <label className="hero-search marketplace-hero-search">
            <Search aria-hidden="true" />
            <span className="sr-only">ابحث فوراً في السوق</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث عن سيارة، منزل، هاتف، أو محافظة..."
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="hero-search-hint"
                aria-label="مسح البحث"
              >
                مسح
              </button>
            ) : (
              <span className="hero-search-hint" aria-hidden="true">اكتب للبحث</span>
            )}
          </label>
          <div className="hero-trust" aria-label="مزايا مَسار">
            <span><ShieldCheck aria-hidden="true" /> مراجعة قبل النشر</span>
  
