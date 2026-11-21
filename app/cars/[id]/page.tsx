import { CarPhoto } from '@/components/marketplace/car-photo'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { ArrowRight, BadgeCheck, CalendarDays, Gauge, MapPin, Phone, ShieldCheck, Wrench } from 'lucide-react'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'
const money = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 })

type CarPageProps = {
  params: Promise<{ id: string }>
}

export default async function CarPage({ params }: CarPageProps) {
  const { id } = await params
  const [car] = await db.select().from(carListings).where(eq(carListings.id, id)).limit(1)
  if (!car || car.status !== 'approved') notFound()

  const images = car.images.map((image) => image.startsWith('http')
    ? image
    : `/api/car-images?listing=${encodeURIComponent(car.id)}&path=${encodeURIComponent(image)}`)
  const phone = car.sellerPhone?.replace(/[^\d+]/g, '')

  return (
    <main className="detail-page page-container">
      <div className="detail-breadcrumb"><Link href="/">السيارات</Link><span>/</span><span>{car.make} {car.model}</span></div>
      <div className="detail-layout">
        <section className="detail-main">
          <div className="detail-photo-wrap">
            {images.length ? <CarPhoto src={images[0]} alt={`${car.make} ${car.model}`} width={1200} height={780} className="detail-photo" /> : <div className="detail-photo-fallback" />}
            <span className="condition-badge detail-condition">{car.condition === 'new' ? 'جديدة' : 'مستعملة'}</span>
          </div>
          <div className="detail-title-block">
            <div><span className="listing-make">{car.make}</span><h1>{car.model}</h1></div>
            <span className="detail-year">{car.year}</span>
          </div>
          <div className="detail-specs">
            <div><Gauge aria-hidden="true" /><span>الممشى</span><strong>{money.format(car.mileage)} كم</strong></div>
            <div><MapPin aria-hidden="true" /><span>الموقع</span><strong>{car.city || 'السعودية'}</strong></div>
            <div><CalendarDays aria-hidden="true" /><span>مدة الاستخدام</span><strong>{car.condition === 'new' ? 'جديدة' : `${car.usageMonths ?? 0} شهر`}</strong></div>
          </div>
          <section className="detail-section">
            <h2>عن السيارة</h2>
            <p>{car.description || 'تفاصيل السيارة متوفرة مباشرة من المعلن.'}</p>
          </section>
          <section className="detail-section condition-report">
            <h2>سجل السيارة</h2>
            <div className="report-row"><span><Wrench aria-hidden="true" /> زيارات الصيانة</span><strong>{car.maintenanceVisited ? 'نعم' : 'لا'}</strong></div>
            {car.maintenanceReason && <p className="report-note">{car.maintenanceReason}</p>}
            <div className="report-row"><span><ShieldCheck aria-hidden="true" /> إصلاحات سابقة</span><strong>{car.repaired ? 'نعم' : 'لا'}</strong></div>
            {car.repairDetails && <p className="report-note">{car.repairDetails}</p>}
            <div className="report-row"><span><Wrench aria-hidden="true" /> قطع تم تغييرها</span><strong>{car.partsChanged ? 'نعم' : 'لا'}</strong></div>
            {car.changedParts && <p className="report-note">{car.changedParts}</p>}
          </section>
        </section>

        <aside className="detail-aside">
          <div className="price-card">
            <span className="eyebrow eyebrow-green">السعر المطلوب</span>
            <p className="detail-price"><strong>{money.format(car.askingPrice)}</strong> <span>ر.س</span></p>
            {(car.negotiationMin || car.negotiationMax) && <p className="negotiation-note">قابل للتفاوض <span>{car.negotiationMin ? `من ${money.format(car.negotiationMin)}` : ''}{car.negotiationMin && car.negotiationMax ? ' — ' : ''}{car.negotiationMax ? `إلى ${money.format(car.negotiationMax)}` : ''} ر.س</span></p>}
            {phone ? <a className="primary-button full-button" href={`tel:${phone}`}><Phone aria-hidden="true" /> تواصل مع المعلن</a> : <button className="primary-button full-button" type="button" disabled><Phone aria-hidden="true" /> رقم التواصل غير متوفر</button>}
            <p className="secure-note"><BadgeCheck aria-hidden="true" /> الإعلان تمت مراجعته من فريق مَسَار</p>
          </div>
          <div className="seller-card"><span className="seller-avatar">{car.sellerName?.slice(0, 1) || 'م'}</span><div><span>المعلن</span><strong>{car.sellerName || 'معلن مَسَار'}</strong></div><BadgeCheck aria-label="إعلان موثّق" /></div>
          <Link className="back-link" href="/">العودة إلى السيارات <ArrowRight aria-hidden="true" /></Link>
        </aside>
      </div>
    </main>
  )
}
