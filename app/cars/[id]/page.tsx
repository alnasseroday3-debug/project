import { CarPhoto } from '@/components/marketplace/car-photo'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, CircleX, Gauge, MapPin, Phone, ShieldCheck, Wrench } from 'lucide-react'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'
const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

type CarPageProps = {
  params: Promise<{ id: string }>
}

function InspectionCard({ icon, title, answer, details }: { icon: React.ReactNode; title: string; answer: boolean; details: string | null }) {
  return (
    <article className="inspection-card">
      <div className="inspection-card-top"><span className="inspection-icon">{icon}</span><h3>{title}</h3></div>
      <span className={`inspection-badge${answer ? ' is-yes' : ' is-no'}`}>
        {answer ? <CheckCircle2 aria-hidden="true" /> : <CircleX aria-hidden="true" />}
        {answer ? 'نعم' : 'لا'}
      </span>
      {answer && <div className="inspection-details"><strong>التفاصيل</strong><p>{details || 'لم يضف البائع تفاصيل إضافية.'}</p></div>}
    </article>
  )
}

export default async function CarPage({ params }: CarPageProps) {
  const { id } = await params
  const [car] = await db.select().from(carListings).where(eq(carListings.id, id)).limit(1)
  if (!car || car.status !== 'approved') notFound()

  const images = car.images.map((image) => image.startsWith('http') || image.startsWith('/')
    ? image
    : `/api/car-images?listing=${encodeURIComponent(car.id)}&path=${encodeURIComponent(image)}`)
  const phoneDigits = car.sellerPhone?.replace(/\D/g, '')
  const whatsappNumber = phoneDigits?.startsWith('0')
    ? `963${phoneDigits.slice(1)}`
    : phoneDigits && phoneDigits.length === 9 && phoneDigits.startsWith('9')
      ? `963${phoneDigits}`
      : phoneDigits
  const whatsappMessage = encodeURIComponent(`مرحباً، أنا مهتم بـ ${car.make} ${car.model} ${car.year}. هل ما زالت متاحة؟`)
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
            <div><MapPin aria-hidden="true" /><span>الموقع</span><strong>{car.city || 'سوريا'}</strong></div>
            <div><CalendarDays aria-hidden="true" /><span>مدة الاستخدام</span><strong>{car.condition === 'new' ? 'جديدة' : `${car.usageMonths ?? 0} شهر`}</strong></div>
          </div>
          <section className="detail-section">
            <h2>عن السيارة</h2>
            <p>{car.description || 'تفاصيل السيارة متوفرة مباشرة من المعلن.'}</p>
          </section>
          <section className="detail-section condition-report">
            <div className="inspection-heading"><div><span className="eyebrow eyebrow-green">شفافية من البائع</span><h2>الفحص الفني</h2></div><span className="inspection-caption">إجابات موثّقة في الإعلان</span></div>
            <div className="inspection-grid">
              <InspectionCard icon={<Wrench aria-hidden="true" />} title="زيارات الصيانة" answer={car.maintenanceVisited} details={car.maintenanceReason} />
              <InspectionCard icon={<ShieldCheck aria-hidden="true" />} title="إصلاح أو حادث" answer={car.repaired} details={car.repairDetails} />
              <InspectionCard icon={<Wrench aria-hidden="true" />} title="تغيير قطع أساسية" answer={car.partsChanged} details={car.changedParts} />
            </div>
          </section>
        </section>

        <aside className="detail-aside">
          <div className="price-card">
            <span className="eyebrow eyebrow-green">السعر المطلوب</span>
            <p className="detail-price" dir="ltr"><strong>${money.format(car.askingPrice)}</strong></p>
            {(car.negotiationMin || car.negotiationMax) && <p className="negotiation-note">قابل للتفاوض <span dir="ltr">{car.negotiationMin ? `$${money.format(car.negotiationMin)}` : ''}{car.negotiationMin && car.negotiationMax ? ' — ' : ''}{car.negotiationMax ? `$${money.format(car.negotiationMax)}` : ''}</span></p>}
            {whatsappNumber ? <a className="whatsapp-button" href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer"><Phone aria-hidden="true" /> تواصل عبر واتساب</a> : <button className="whatsapp-button" type="button" disabled><Phone aria-hidden="true" /> رقم التواصل غير متوفر</button>}
            {phone && <a className="phone-button" href={`tel:${phone}`}><Phone aria-hidden="true" /> اتصال هاتفي</a>}
            <p className="secure-note"><BadgeCheck aria-hidden="true" /> الإعلان تمت مراجعته من فريق مَسَار</p>
          </div>
          <div className="seller-card"><span className="seller-avatar">{car.sellerName?.slice(0, 1) || 'م'}</span><div><span>المعلن</span><strong>{car.sellerName || 'معلن مَسَار'}</strong></div><BadgeCheck aria-label="إعلان موثّق" /></div>
          <Link className="back-link" href="/">العودة إلى السيارات <ArrowRight aria-hidden="true" /></Link>
        </aside>
      </div>
    </main>
  )
}
