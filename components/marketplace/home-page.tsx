'use client'

import Image from 'next/image'
import { CarPhoto } from '@/components/marketplace/car-photo'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowUpLeft, BadgeCheck, CarFront, CircleHelp, Cog, Gauge, MapPin, Paintbrush, Search, ShieldCheck, SlidersHorizontal, Sparkles, Tag } from 'lucide-react'
import type { PublicCarListing } from '@/lib/db/schema'
import { carImageUrl } from '@/lib/car-image-url'

type HomeCar = PublicCarListing & {
  negotiationMin: number | null
  negotiationMax: number | null
  transmission?: string | null
  paintCondition?: string | null
}

const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const brands = [
  { label: 'الكل', value: 'all', aliases: [] },
  { label: 'كيا', value: 'kia', aliases: ['كيا', 'kia'] },
  { label: 'هيونداي', value: 'hyundai', aliases: ['هيونداي', 'هيونداى', 'hyundai'] },
  { label: 'تويوتا', value: 'toyota', aliases: ['تويوتا', 'toyota'] },
  { label: 'مرسيدس', value: 'mercedes', aliases: ['مرسيدس', 'مرسيدس بنز', 'mercedes', 'mercedes-benz'] },
  { label: 'شيري', value: 'chery', aliases: ['شيري', 'chery'] },
  { label: 'بيجو', value: 'peugeot', aliases: ['بيجو', 'peugeot'] },
  { label: 'شيفروليه', value: 'chevrolet', aliases: ['شيفروليه', 'شفروليه', 'chevrolet'] },
  { label: 'نيسان', value: 'nissan', aliases: ['نيسان', 'nissan'] },
  { label: 'BMW', value: 'bmw', aliases: ['bmw', 'بي ام دبليو', 'بي إم دبليو'] },
  { label: 'أودي', value: 'audi', aliases: ['أودي', 'اودي', 'audi'] },
] as const

function ListingCard({ car }: { car: HomeCar }) {
  return (
    <article className="listing-card">
      <Link className="listing-image-link" href={`/cars/${car.id}`} aria-label={`عرض ${car.make} ${car.model}`}>
        <CarPhoto src={carImageUrl(car)} alt={`${car.make} ${car.model} ${car.year}`} width={720} height={480} className="listing-image" />
        <span className="condition-badge">{car.condition === 'new' ? 'جديدة' : 'مستعملة'}</span>
        <span className="image-arrow"><ArrowUpLeft aria-hidden="true" /></span>
      </Link>
      <div className="listing-content">
        <div className="listing-title-row">
          <div>
            <span className="listing-make">{car.make}</span>
            <h3>{car.model}</h3>
          </div>
          <span className="listing-year">{car.year}</span>
        </div>
        <div className="listing-badges" aria-label="معلومات السيارة">
          {car.verified && <span className="verified-pill"><BadgeCheck aria-hidden="true" /> موثق من مَسَار ✓</span>}
          {(car.negotiable || car.negotiationMin !== null || car.negotiationMax !== null) && <span className="listing-info-badge is-negotiable"><Tag aria-hidden="true" /> قابل للتفاوض</span>}
          {car.transmission && <span className="listing-info-badge"><Cog aria-hidden="true" /> {car.transmission === 'automatic' ? 'أوتوماتيك' : car.transmission === 'manual' ? 'عادي' : car.transmission}</span>}
          {car.paintCondition && <span className="listing-info-badge"><Paintbrush aria-hidden="true" /> {car.paintCondition === 'clean' ? 'دهان سليم' : car.paintCondition === 'interior' ? 'زنار' : car.paintCondition === 'panels' ? 'بخ قطعتين أو ثلاث' : car.paintCondition}</span>}
        </div>
        <div className="listing-meta">
          <span><Gauge aria-hidden="true" />{car.mileageUnknown ? 'العداد متوقف / لا أعلم' : `${money.format(car.mileage)} كم`}</span>
          <span><MapPin aria-hidden="true" />{car.city || 'سوريا'}</span>
        </div>
        <div className="listing-price-row">
          <p className="listing-price" dir="ltr"><strong>${money.format(car.askingPrice)}</strong></p>
          <Link className="text-link" href={`/cars/${car.id}`} aria-label={`تفاصيل ${car.make} ${car.model}`}><ArrowLeft aria-hidden="true" /></Link>
        </div>
      </div>
    </article>
  )
}

export function HomePage({ cars }: { cars: HomeCar[] }) {
  const [query, setQuery] = useState('')
  const [condition, setCondition] = useState<'all' | 'new' | 'used'>('all')
  const [selectedBrand, setSelectedBrand] = useState<string>('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const filteredCars = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ar')
    const minimum = minPrice === '' ? null : Number(minPrice)
    const maximum = maxPrice === '' ? null : Number(maxPrice)
    const activeBrand = brands.find((brand) => brand.value === selectedBrand)
    return cars.filter((car) => {
      const matchesCondition = condition === 'all' || car.condition === condition
      const matchesMinimum = minimum === null || car.askingPrice >= minimum
      const matchesMaximum = maximum === null || car.askingPrice <= maximum
      const normalizedMake = car.make.trim().toLocaleLowerCase('ar')
      const matchesBrand = selectedBrand === 'all' || Boolean(activeBrand?.aliases.some((alias) => normalizedMake === alias.toLocaleLowerCase('ar')))
      const searchable = `${car.make} ${car.model} ${car.year} ${car.city ?? ''}`.toLocaleLowerCase('ar')
      return matchesCondition && matchesMinimum && matchesMaximum && matchesBrand && (!normalizedQuery || searchable.includes(normalizedQuery))
    })
  }, [cars, condition, maxPrice, minPrice, query, selectedBrand])

  return (
    <main>
      <section className="hero-section page-container">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> سوق سيارات يليق باختيارك</span>
          <h1>طريقك إلى<br /><span>السيارة الصح.</span></h1>
          <p>تفاصيل واضحة، إعلانات موثوقة، وتجربة شراء تبدأ براحة بال.</p>
          <div className="hero-actions">
            <a className="primary-button" href="#cars">اكتشف السيارات <ArrowLeft aria-hidden="true" /></a>
            <Link className="hero-secondary" href="/sell">أضف إعلانك <ArrowUpLeft aria-hidden="true" /></Link>
          </div>
          <div className="hero-proof"><span className="proof-avatars" aria-hidden="true"><i>م</i><i>ر</i><i>س</i></span><span><strong>إعلانات يراجعها فريقنا</strong><br />قبل أن تظهر لك.</span><ShieldCheck aria-hidden="true" className="proof-check" /></div>
        </div>
        <div className="hero-visual">
          <Image src="/images/hero-cars.png" alt="سيارة أنيقة في شارع عصري وقت الغروب" fill priority unoptimized className="hero-image" />
          <div className="hero-image-shade" />
          <div className="hero-image-caption"><span>اختيار هذا الأسبوع</span><strong>كل تفصيلة تفرق.</strong></div>
          <div className="hero-index"><span>01</span><i /><span>04</span></div>
        </div>
        <div className="hero-bottom-note"><span>01 / اكتشف</span><span>سيارتك القادمة أقرب مما تتوقع</span></div>
      </section>

      <section className="trust-strip page-container" aria-label="مزايا مَسَار">
        <div><ShieldCheck aria-hidden="true" /><span><strong>مراجعة قبل النشر</strong><small>كل إعلان يمر على فريقنا</small></span></div>
        <div><Tag aria-hidden="true" /><span><strong>أسعار واضحة</strong><small>قيمة وتفاصيل بدون مفاجآت</small></span></div>
        <div><CircleHelp aria-hidden="true" /><span><strong>قرارك براحتك</strong><small>تواصل مباشر مع صاحب الإعلان</small></span></div>
        <div className="trust-note"><Sparkles aria-hidden="true" /> اختيار واثق يبدأ من هنا</div>
      </section>

      <section className="inventory-section" id="cars">
        <div className="page-container">
          <div className="section-heading">
            <div>
              <span className="eyebrow eyebrow-green">اختيرت بعناية</span>
              <h2>سيارات تستحق <span>توقفك.</span></h2>
              <p>تصفح أحدث الإعلانات التي اجتازت مراجعة مَسَار.</p>
            </div>
            <Link className="all-listings-link" href="/sell">أضف سيارتك <ArrowLeft aria-hidden="true" /></Link>
          </div>

          <div className="filter-bar">
            <label className="search-box">
              <Search aria-hidden="true" />
              <span className="sr-only">ابحث عن ماركة أو موديل أو مدينة</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن ماركة، موديل أو مدينة" />
            </label>
            <div className="filter-tabs" role="group" aria-label="تصفية حسب حالة السيارة">
              {([
                ['all', 'الكل'],
                ['new', 'جديدة'],
                ['used', 'مستعملة'],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" className={condition === value ? 'filter-chip is-selected' : 'filter-chip'} onClick={() => setCondition(value)} aria-pressed={condition === value}>{label}</button>
              ))}
            </div>
            <fieldset className="price-filter">
              <legend className="sr-only">نطاق السعر بالدولار الأمريكي</legend>
              <label><span className="sr-only">أقل سعر بالدولار</span><input aria-label="أقل سعر بالدولار" type="number" min="0" inputMode="numeric" placeholder="من $" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} /></label>
              <span aria-hidden="true">–</span>
              <label><span className="sr-only">أعلى سعر بالدولار</span><input aria-label="أعلى سعر بالدولار" type="number" min="0" inputMode="numeric" placeholder="إلى $" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></label>
            </fieldset>
            <span className="result-count"><SlidersHorizontal aria-hidden="true" /> {filteredCars.length} إعلانات</span>
          </div>

          <div className="brand-filter-strip" role="group" aria-label="تصفية السيارات حسب الماركة">
            {brands.map((brand) => (
              <button key={brand.value} type="button" className={selectedBrand === brand.value ? 'brand-filter-chip is-selected' : 'brand-filter-chip'} onClick={() => setSelectedBrand(brand.value)} aria-pressed={selectedBrand === brand.value}>
                <CarFront aria-hidden="true" />
                <span>{brand.label}</span>
              </button>
            ))}
          </div>

          {filteredCars.length ? (
            <div className="listing-grid">
              {filteredCars.map((car) => <ListingCard key={car.id} car={car} />)}
            </div>
          ) : (
            <div className="empty-results"><Search aria-hidden="true" /><strong>ما لقينا سيارة بهذي المواصفات</strong><span>جرّب كلمة بحث ثانية أو غيّر نوع السيارة.</span></div>
          )}
        </div>
      </section>

      <section className="sell-banner page-container">
        <div className="sell-banner-mark"><CarFrontIcon /></div>
        <div><span className="eyebrow">خطوتك التالية</span><h2>سيارتك لها صاحبها القادم.</h2><p>أضف إعلانك، وفريقنا يتولى مراجعته قبل ما يوصل للمهتمين.</p></div>
        <Link href="/sell" className="banner-button">أضف إعلانك <ArrowLeft aria-hidden="true" /></Link>
      </section>

      <div className="bottom-spacer" />
    </main>
  )
}

function CarFrontIcon() {
  return <span className="banner-car-icon" aria-hidden="true">مَ</span>
}
