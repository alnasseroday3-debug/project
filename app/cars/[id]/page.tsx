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
  const [car] = await db.select({
    id: carListings.id,
    make: carListings.make,
    model: carListings.model,
    year: carListings.year,
    condition: carListings.condition,
    mileage: carListings.mileage,
    mileageUnknown: carListings.mileageUnknown,
    usageMonths: carListings.usageMonths,
    maintenanceVisited: carListings.maintenanceVisited,
    maintenanceReason: carListings.maintenanceReason,
    repaired: carListings.repaired,
    repairDetails: carListings.repairDetails,
    partsChanged: carListings.partsChanged,
    changedParts: carListings.changedParts,
    askingPrice: carListings.askingPrice,
    negotiationMin: carListings.negotiationMin,
    negotiationMax: carListings.negotiationMax,
    negotiable: carListings.negotiable,
    paintCondition: carListings.paintCondition,
    paintDetails: carListings.paintDetails,
    transmission: carListings.transmission,
    fuelType: carListings.fuelType,
    registrationStatus: carListings.registrationStatus,
    whatsappOnly: carListings.whatsappOnly,
    city: carListings.city,
    description: carListings.description,
    images: carListings.images,
    status: carListings.status,
    sellerName: carListings.sellerName,
    sellerPhone: carListings.sellerPhone,
    verified: carListings.verified,
  }).from(carListings).where(eq(carListings.id, id)).limit(1)
  if (!car || car.status !== 'approved') notFound()

  const images = car.images.map((image) => image.startsWith('http') || image.startsWith('/')
    ? image
    : `/api/car-images?listing=${encodeURIComponent(car.id)}&path=${encodeURIComponent(image)}`)
  const phoneDigits = car.sellerPhone?.replace(/\D/g, '')
  const whatsappNumber = phoneDigits?.startsWith('09')
    ? `963${phoneDigits.slice(1)}`
    : phoneDigits?.startsWith('963')
      ? phoneDigits
      : phoneDigits && phoneDigits.length === 9 && phoneDigits.startsWith('9')
        ? `963${phoneDigits}`
        : phoneDigits
  const whatsappMessage = encodeURIComponent(`مرحباً، شفت إعلان سيارتك (${car.make} ${car.model}، سنة الصنع ${car.year}) المعروضة على منصة مَسَار بسعر ${money.format(car.askingPrice)} دولار وحابب استفسر عنها.`)
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
            <div><span className="listing-make">{car.make}</span><h1>{car.model}</h1>{car.verified && <span className="verified-pill"><BadgeCheck aria-hidden="true" /> موثق من مَسَار ✓</span>}</div>
            <span className="detail-year">{car.year}</span>
          </div>
          <div className="detail-specs">
            <div><Gauge aria-hidden="true" /><span>الممشى</span><strong>{car.mileageUnknown ? 'العداد متوقف / لا أعلم' : `${money.format(car.mileage)} كم`}</strong></div>
            <div><MapPin aria-hidden="true" /><span>الموقع</span><strong>{car.city || 'سوريا'}</strong></div>
            <div><CalendarDays aria-hidden="true" /><span>مدة الاستخدام</span><strong>{car.condition === 'new' ? 'جديدة' : `${car.usageMonths ?? 0} شهر`}</strong></div>
          </div>
          <section className="detail-section detail-market-section" aria-label="مواصفات السيارة">
            <h2>مواصفات السوق</h2>
            <dl className="detail-market-grid">
              <div><dt>حالة البخ (الدهان)</dt><dd>{car.paintCondition === 'clean' ? 'خالية العلام جوا وبرا' : car.paintCondition === 'interior' ? 'خالية من الداخل — زنار' : car.paintCondition === 'panels' ? 'بخ قطعتين أو ثلاث' : 'غير محددة'}</dd>{car.paintDetails && <small>{car.paintDetails}</small>}</div>
              <div><dt>نوع الغيار</dt><dd>{car.transmission === 'automatic' ? 'أوتوماتيك' : car.transmission === 'manual' ? 'عادي' : 'غير محدد'}</dd></div>
              <div><dt>نوع الوقود</dt><dd>{car.fuelType === 'gasoline' ? 'بنزين' : car.fuelType === 'diesel' ? 'مازوت' : car.fuelType === 'hybrid' ? 'هايبرد' : car.fuelType === 'electric' ? 'كهرباء' : 'غير محدد'}</dd></div>
              <div><dt>حالة الأوراق والنمرة</dt><dd>{car.registrationStatus === 'syrian' ? 'نمرة سورية نظامية' : car.registrationStatus === 'new-entry' ? 'إدخال جديد' : car.registrationStatus === 'customs-cleared' ? 'مجمركة' : car.registrationStatus === 'immediate-transfer' ? 'فراغ فوري' : 'غير محددة'}</dd></div>
            </dl>
          </section>
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
            {(car.negotiable || car.negotiationMin || car.negotiationMax) && <p className="negotiation-note">قابل للتفاوض <span dir="ltr">{car.negotiationMin ? `$${money.format(car.negotiationMin)}` : ''}{car.negotiationMin && car.negotiationMax ? ' — ' : ''}{car.negotiationMax ? `$${money.format(car.negotiationMax)}` : ''}</span></p>}
            {whatsappNumber ? <a className="whatsapp-button" href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer"><Phone aria-hidden="true" /> تواصل عبر واتساب</a> : <button className="whatsapp-button" type="button" disabled><Phone aria-hidden="true" /> رقم التواصل غير متوفر</button>}
            {phone && !car.whatsappOnly && <a className="phone-button" href={`tel:${phone}`}><Phone aria-hidden="true" /> اتصال هاتفي</a>}
            {car.whatsappOnly && <p className="whatsapp-only-note">التواصل عبر واتساب فقط</p>}
            <p className="secure-note"><BadgeCheck aria-hidden="true" /> الإعلان تمت مراجعته من فريق مَسَار</p>
          </div>
          <div className="seller-card"><span className="seller-avatar">{car.sellerName?.slice(0, 1) || 'م'}</span><div><span>المعلن</span><strong>{car.sellerName || 'معلن مَسَار'}</strong>{car.verified && <span className="seller-verified">موثق من مَسَار ✓</span>}</div>{car.verified && <BadgeCheck aria-label="إعلان موثق من مَسَار" />}</div>
          <Link className="back-link" href="/">العودة إلى السيارات <ArrowRight aria-hidden="true" /></Link>
        </aside>
      </div>
    </main>
  )
}
