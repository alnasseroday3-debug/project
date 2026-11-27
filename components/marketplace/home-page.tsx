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
  Search,
  ShieldCheck,
  Shirt,
  Smartphone,
  Tag,
  X,
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
          {isCar && listing.transmission && <span className="listing-info-badge"><CarFront aria-hidden="true" /> {listing.transmission === 'automatic' ? 'أوتوماتيك' : listing.transmission === 'manual' ? 'عادي' : listing.transmission}</span>}
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
        <Link className="listing-details-button" href={`/cars/${listing.id}`} aria-label={`عرض تفاصيل ${title}`}>عرض التفاصيل <ArrowLeft aria-hidden="true" /></Link>
      </div>
    </article>
  )
}
  export function HomePage({ isAuthenticated }: { initialPage?: ListingsPage; isAuthenticated: boolean }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | ListingCategory>('all')
  const [governorate, setGovernorate] = useState('')
  const [condition, setCondition] = useState<'all' | 'new' | 'used'>('all')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [publicationPeriod, setPublicationPeriod] = useState<'all' | 'week' | 'month' | 'year'>('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const showInventory =
    category !== 'all' ||
    Boolean(query.trim()) ||
    Boolean(governorate) ||
    publicationPeriod !== 'all' ||
    Boolean(minPrice) ||
    Boolean(maxPrice)

  const getKey = (pageIndex: number, previousPage: ListingsPage | null) => {
    if (!showInventory) return null
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
    persistSize: false,
    revalidateFirstPage: false,
  })

  const listings = useMemo(() => (data ? data.flatMap((page) => page.items) : []), [data])
  const hasMore = data?.[data.length - 1]?.hasMore ?? false
  const loadedCount = listings.length

  function selectCategory(nextCategory: ListingCategory) {
    setCategory((prev) => (prev === nextCategory ? 'all' : nextCategory))
    setSelectedBrand('all')
    setCondition('all')
    if (nextCategory !== 'cars') {
      setMinPrice('')
      setMaxPrice('')
    }
  }

  function resetFilters() {
    setCategory('all')
    setQuery('')
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
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن سيارة، منزل، هاتف، أو محافظة..." />
            <span className="hero-search-hint" aria-hidden="true">اكتب للبحث</span>
          </label>
          <div className="hero-trust" aria-label="مزايا مَسار">
            <span><ShieldCheck aria-hidden="true" /> مراجعة قبل النشر</span>
            <span><CircleHelp aria-hidden="true" /> تواصل مباشر</span>
            <span><Tag aria-hidden="true" /> تفاصيل واضحة</span>
          </div>
        </div>
      </section>

      <div className="marketplace-discovery page-container">
        <div className="marketplace-control-row">
          <Link className="marketplace-add-button" href="/sell"><span>+</span> إضافة إعلان</Link>
          <div className="marketplace-filter-group" aria-label="تصفية الإعلانات">
            <label className="marketplace-select"><span>المحافظة</span><select value={governorate} onChange={(event) => setGovernorate(event.target.value)} aria-label="تصفية حسب المحافظة"><option value="">كل المحافظات</option>{syrianGovernorates.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
            <label className="marketplace-select"><span>تاريخ النشر</span><select value={publicationPeriod} onChange={(event) => setPublicationPeriod(event.target.value as typeof publicationPeriod)} aria-label="تصفية حسب تاريخ النشر"><option value="all">الكل</option><option value="week">أسبوع</option><option value="month">شهر</option><option value="year">سنة</option></select></label>
          </div>
        </div>

        <CategoryGrid selectedCategory={category} onSelect={selectCategory} />

        {showInventory && (
          <section className="inventory-section" id="listings" aria-labelledby="listings-title">
            <div className="section-heading">
              <div>
                <span className="eyebrow eyebrow-green">نتائج التصفية</span>
                <h2 id="listings-title">{category !== 'all' ? listingCategoryLabels[category] : 'نتائج البحث'}</h2>
                <p>الإعلانات المنشورة المطابقة لاختيارك.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="result-count"><Clock3 aria-hidden="true" /> {loadedCount}{hasMore ? '+' : ''} إعلان</span>
                <button type="button" className="filter-chip" onClick={resetFilters}><X aria-hidden="true" style={{ width: 14, height: 14 }} /> إغلاق</button>
              </div>
            </div>

            {category === 'cars' && (
              <div className="marketplace-car-filters">
                <div className="filter-tabs" role="group" aria-label="تصفية السيارات حسب حالتها">
                  {([['all', 'الكل'], ['new', 'جديدة'], ['used', 'مستعملة']] as const).map(([value, label]) => (
                    <button key={value} type="button" className={condition === value ? 'filter-chip is-selected' : 'filter-chip'} onClick={() => setCondition(value)} aria-pressed={condition === value}>{label}</button>
                  ))}
                </div>
                <fieldset className="price-filter">
                  <legend className="sr-only">نطاق السعر بالدولار الأمريكي</legend>
                  <label><span className="sr-only">أقل سعر</span><input aria-label="أقل سعر بالدولار" type="number" min="1" inputMode="numeric" placeholder="من $" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} /></label>
                  <span aria-hidden="true">–</span>
                  <label><span className="sr-only">أعلى سعر</span><input aria-label="أعلى سعر بالدولار" type="number" min="1" inputMode="numeric" placeholder="إلى $" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></label>
                </fieldset>
              </div>
            )}

            {category === 'cars' && (
              <div className="brand-filter-strip" role="group" aria-label="تصفية السيارات حسب الماركة">
                <button type="button" className={selectedBrand === 'all' ? 'brand-filter-chip is-selected' : 'brand-filter-chip'} onClick={() => setSelectedBrand('all')} aria-pressed={selectedBrand === 'all'}><CarFront aria-hidden="true" /><span>كل الماركات</span></button>
                {brands.map((brand) => (
                  <button key={brand.value} type="button" className={selectedBrand === brand.value ? 'brand-filter-chip is-selected' : 'brand-filter-chip'} onClick={() => setSelectedBrand(brand.value)} aria-pressed={selectedBrand === brand.value}><CarFront aria-hidden="true" /><span>{brand.label}</span></button>
                ))}
              </div>
            )}

            {error && <p className="marketplace-fetch-error" role="alert">تعذّر تحميل الإعلانات. حدّث الصفحة للمحاولة مجدداً.</p>}
            {listings.length ? (
              <div className="listing-grid">
                {listings.map((listing) => <ListingCard key={listing.id} listing={listing} isAuthenticated={isAuthenticated} />)}
              </div>
            ) : isLoading ? (
              <p className="marketplace-loading" role="status">جارٍ تحميل الإعلانات…</p>
            ) : (
              <div className="empty-results">
                <Search aria-hidden="true" />
                <strong>لا توجد إعلانات مطابقة</strong>
                <span>جرّب تغيير كلمات البحث أو الفلاتر.</span>
              </div>
            )}
            {hasMore && (
              <div className="marketplace-load-more-wrap">
                <button className="marketplace-load-more" type="button" onClick={() => setSize(size + 1)} disabled={isValidating}>
                  {isValidating ? 'جارٍ تحميل المزيد…' : 'عرض المزيد'} <ArrowLeft aria-hidden="true" />
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      <section className="sell-banner page-container">
        <div className="sell-banner-mark"><span className="banner-car-icon">مَ</span></div>
        <div><span className="eyebrow">خطوتك التالية</span><h2>لديك شيء تريد عرضه؟</h2><p>أضف إعلانك في القسم المناسب، وفريقنا يتولى مراجعته قبل النشر.</p></div>
        <Link href="/sell" className="banner-button">أضف إعلانك <ArrowLeft aria-hidden="true" /></Link>
      </section>
      <div className="bottom-spacer" />
    </main>
  )
  }
      
