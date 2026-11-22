import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, CircleX, Gauge, House, MapPin, Phone, Ruler, ShieldCheck, Smartphone, Store, Tag, Wrench } from 'lucide-react'
import { ShareListingButton } from '@/components/marketplace/share-listing-button'
import { ListingGallery } from '@/components/marketplace/listing-gallery'
import { ListingDetailActions } from '@/components/marketplace/listing-detail-actions'
import { getCurrentSession, isAdminEmail } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'
import { listingCategoryLabels, type ListingCategory, type ListingDetails } from '@/lib/listing-categories'

export const dynamic = 'force-dynamic'
const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

type CarPageProps = {
  params: Promise<{ id: string }>
}

function selectedDetail(details: ListingDetails, field: string, otherField: string) {
  return details[field] === 'other' ? details[otherField] ?? '' : details[field] ?? ''
}

function categorySpecs(category: ListingCategory, details: ListingDetails) {
  const condition = details.condition || selectedDetail(details, 'propertyCondition', 'propertyConditionOther')
  const itemType = category === 'real_estate' ? selectedDetail(details, 'propertyType', 'propertyTypeOther') : selectedDetail(details, 'itemType', 'itemTypeOther')
  const brand = selectedDetail(details, 'brand', 'brandOther')
  const specs = category === 'real_estate'
    ? [
        { icon: <House aria-hidden="true" />, label: 'نوع العقار', value: itemType },
        { icon: <Ruler aria-hidden="true" />, label: 'المساحة', value: details.areaSqm ? `${details.areaSqm} م²` : '' },
        { icon: <Tag aria-hidden="true" />, label: 'عدد الغرف', value: details.rooms },
        { icon: <House aria-hidden="true" />, label: 'الطابق', value: selectedDetail(details, 'floor', 'floorOther') },
        { icon: <BadgeCheck aria-hidden="true" />, label: 'الإكساء', value: selectedDetail(details, 'propertyCondition', 'propertyConditionOther') },
        { icon: <ShieldCheck aria-hidden="true" />, label: 'نوع الملكية', value: selectedDetail(details, 'ownershipType', 'ownershipOther') },
      ]
    : category === 'furniture'
      ? [{ icon: <House aria-hidden="true" />, label: 'نوع الأثاث', value: itemType }, { icon: <BadgeCheck aria-hidden="true" />, label: 'الحالة', value: condition }, { icon: <Tag aria-hidden="true" />, label: 'القطع أو الخشب', value: details.piecesOrWood }]
      : category === 'appliances'
        ? [{ icon: <Tag aria-hidden="true" />, label: 'نوع الأداة', value: itemType }, { icon: <Tag aria-hidden="true" />, label: 'الماركة', value: brand }, { icon: <Ruler aria-hidden="true" />, label: 'السعة أو الاستطاعة', value: details.capacity }, { icon: <BadgeCheck aria-hidden="true" />, label: 'الحالة', value: condition }]
        : category === 'electronics'
          ? details.itemType === 'موبايل'
            ? [{ icon: <Smartphone aria-hidden="true" />, label: 'الجهاز', value: 'موبايل' }, { icon: <Tag aria-hidden="true" />, label: 'الماركة', value: brand }, { icon: <Tag aria-hidden="true" />, label: 'الموديل', value: details.deviceModel }, { icon: <Tag aria-hidden="true" />, label: 'السعة التخزينية', value: selectedDetail(details, 'storage', 'storageOther') }, { icon: <Tag aria-hidden="true" />, label: 'الرام', value: selectedDetail(details, 'ram', 'ramOther') }, { icon: <BadgeCheck aria-hidden="true" />, label: 'الحالة', value: condition }, { icon: <ShieldCheck aria-hidden="true" />, label: 'الجمركة', value: details.customsStatus }, { icon: <Tag aria-hidden="true" />, label: 'الملحقات', value: details.accessories }]
            : ['لابتوب', 'كمبيوتر مكتبي', 'كمبيوتر'].includes(details.itemType ?? '')
              ? [{ icon: <Smartphone aria-hidden="true" />, label: 'النوع', value: itemType }, { icon: <Tag aria-hidden="true" />, label: 'الماركة', value: brand }, { icon: <Tag aria-hidden="true" />, label: 'المعالج', value: selectedDetail(details, 'processor', 'processorOther') }, { icon: <Tag aria-hidden="true" />, label: 'الرام', value: selectedDetail(details, 'ram', 'ramOther') }, { icon: <Tag aria-hidden="true" />, label: 'التخزين', value: selectedDetail(details, 'storage', 'storageOther') }, { icon: <Tag aria-hidden="true" />, label: 'كرت الشاشة', value: details.graphicsModel ? `${details.graphicsType} · ${details.graphicsModel}` : details.graphicsType }, { icon: <Wrench aria-hidden="true" />, label: 'تبديل قطع أو صيانة', value: details.partsChanged === 'yes' ? 'نعم، تم التبديل' : details.partsChanged === 'no' ? 'لا، وكالة' : '' }, { icon: <CalendarDays aria-hidden="true" />, label: 'مدة الاستعمال', value: details.usageMonths ? `${details.usageMonths} شهر` : '0 شهر' }]
              : details.itemType === 'بلايستيشن وألعاب'
                ? [{ icon: <Smartphone aria-hidden="true" />, label: 'النوع', value: itemType }, { icon: <Tag aria-hidden="true" />, label: 'الجهاز', value: selectedDetail(details, 'gameConsole', 'gameConsoleOther') }, { icon: <Tag aria-hidden="true" />, label: 'نسخة الجهاز', value: details.gameMedia }, { icon: <Tag aria-hidden="true" />, label: 'عدد القبضات', value: details.controllerCount }, { icon: <BadgeCheck aria-hidden="true" />, label: 'حالة النظام', value: details.gameStatus }]
                : [{ icon: <Smartphone aria-hidden="true" />, label: 'النوع', value: itemType }, { icon: <Tag aria-hidden="true" />, label: 'الماركة', value: brand }, { icon: <Tag aria-hidden="true" />, label: 'المواصفات', value: details.specifications }, { icon: <BadgeCheck aria-hidden="true" />, label: 'الحالة', value: condition }]
          : [{ icon: <Store aria-hidden="true" />, label: 'النوع', value: itemType }, { icon: <Store aria-hidden="true" />, label: 'صفة البائع', value: details.sellerType }, { icon: <Store aria-hidden="true" />, label: 'اسم المحل', value: details.shopName }, { icon: <Tag aria-hidden="true" />, label: 'المقاسات', value: details.size }, { icon: <BadgeCheck aria-hidden="true" />, label: 'الحالة', value: condition }]
  return [...specs, ...(details.district ? [{ icon: <MapPin aria-hidden="true" />, label: 'المنطقة', value: details.district }] : [])].filter((spec) => spec.value)
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
    userId: carListings.userId,
    make: carListings.make,
    model: carListings.model,
    category: carListings.category,
    details: carListings.details,
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
    expiresAt: carListings.expiresAt,
    sellerName: carListings.sellerName,
    sellerPhone: carListings.sellerPhone,
    verified: carListings.verified,
  }).from(carListings).where(eq(carListings.id, id)).limit(1)
  if (!car || car.status !== 'approved' || (car.expiresAt && car.expiresAt <= new Date())) notFound()

  const category = car.category ?? 'cars'
  const details = car.details ?? {}
  const isCar = category === 'cars'
  const specs = categorySpecs(category, details)
  const itemTitle = isCar ? [car.make, car.model].filter(Boolean).join(' ') : car.make || car.model
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
  const whatsappMessage = encodeURIComponent(isCar
    ? `مرحباً، شفت إعلان سيارتك (${car.make} ${car.model}، سنة الصنع ${car.year}) المعروضة على منصة مَسَار بسعر ${money.format(car.askingPrice)} دولار وحابب استفسر عنها.`
    : `مرحباً، شفت إعلان ${itemTitle} على منصة مَسَار بسعر ${money.format(car.askingPrice)} دولار وحابب استفسر عنه.`)
  const phone = car.sellerPhone?.replace(/[^\d+]/g, '')
  const session = await getCurrentSession()
  const isAdmin = Boolean(session?.user && isAdminEmail(session.user.email, session.user.emailVerified, session.user.role))
  const canDelete = Boolean(session?.user && (session.user.id === car.userId || isAdmin))
  const itemType = isCar
    ? 'سيارة'
    : selectedDetail(details, 'propertyType', 'propertyTypeOther') || selectedDetail(details, 'itemType', 'itemTypeOther') || listingCategoryLabels[category]
  const vehicleSpecs = [
    { label: 'القسم', value: listingCategoryLabels.cars },
    { label: 'الحالة', value: car.condition === 'new' ? 'جديدة' : 'مستعملة' },
    { label: 'سنة الصنع', value: String(car.year) },
    { label: 'الممشى', value: car.mileageUnknown ? 'العداد متوقف / لا أعلم' : `${money.format(car.mileage)} كم` },
    { label: 'مدة الاستخدام', value: car.condition === 'new' ? 'جديدة' : `${car.usageMonths ?? 0} شهر` },
    { label: 'حالة الدهان', value: car.paintCondition === 'clean' ? 'خالية العلام جوا وبرا' : car.paintCondition === 'interior' ? 'خالية من الداخل — زنار' : car.paintCondition === 'panels' ? 'بخ قطعتين أو ثلاث' : '' },
    { label: 'تفاصيل الدهان', value: car.paintDetails ?? '' },
    { label: 'نوع الغيار', value: car.transmission === 'automatic' ? 'أوتوماتيك' : car.transmission === 'manual' ? 'عادي' : '' },
    { label: 'نوع الوقود', value: car.fuelType === 'gasoline' ? 'بنزين' : car.fuelType === 'diesel' ? 'مازوت' : car.fuelType === 'hybrid' ? 'هايبرد' : car.fuelType === 'electric' ? 'كهرباء' : '' },
    { label: 'حالة الأوراق والنمرة', value: car.registrationStatus === 'syrian' ? 'نمرة سورية نظامية' : car.registrationStatus === 'new-entry' ? 'إدخال جديد' : car.registrationStatus === 'customs-cleared' ? 'مجمركة' : car.registrationStatus === 'immediate-transfer' ? 'فراغ فوري' : '' },
    { label: 'الموقع', value: [car.city, details.district].filter(Boolean).join('، ') || 'سوريا' },
  ]
  const detailItems = (isCar
    ? [...vehicleSpecs, ...specs]
    : [
        { label: 'القسم', value: listingCategoryLabels[category] },
        { label: 'النوع', value: itemType },
        { label: 'الموقع', value: [car.city, details.district].filter(Boolean).join('، ') || 'سوريا' },
        ...specs,
      ]).filter((item, index, all) => item.value && all.findIndex((candidate) => candidate.label === item.label) === index)

  return (
    <main className="detail-page page-container">
      <div className="detail-breadcrumb"><Link href="/">السوق</Link><span>/</span><span>{itemTitle}</span></div>
      <div className="detail-layout">
        <section className="detail-content-column">
          <header className="detail-title-block">
            <div>
              <span className="detail-category-label">{listingCategoryLabels[category]}</span>
              <span className="detail-type-label">{itemType}</span>
              <h1>{itemTitle || itemType}</h1>
              {car.verified && <span className="verified-pill"><BadgeCheck aria-hidden="true" /> موثق من مَسَار</span>}
            </div>
            {isCar && <span className="detail-year">{car.year}</span>}
          </header>

          <section className="detail-price-panel" aria-label="السعر والتواصل">
            <div><span className="eyebrow eyebrow-green">السعر المطلوب</span><p className="detail-price" dir="ltr"><strong>${money.format(car.askingPrice)}</strong></p></div>
            {(car.negotiable || car.negotiationMin || car.negotiationMax) && <p className="negotiation-note">قابل للتفاوض <span dir="ltr">{car.negotiationMin ? `$${money.format(car.negotiationMin)}` : ''}{car.negotiationMin && car.negotiationMax ? ' — ' : ''}{car.negotiationMax ? `$${money.format(car.negotiationMax)}` : ''}</span></p>}
          </section>

          <section className="detail-section detail-bullet-section" aria-labelledby="detail-specs-title">
            <h2 id="detail-specs-title">تفاصيل الإعلان</h2>
            <ul className="detail-bullet-list">
              {detailItems.map((item) => <li key={item.label}><strong>{item.label}</strong><span>{item.value}</span></li>)}
              {car.whatsappOnly && <li><strong>طريقة التواصل</strong><span>واتساب فقط</span></li>}
            </ul>
          </section>

          <section className="detail-section detail-description-section">
            <h2>{isCar ? 'عن السيارة' : 'عن الإعلان'}</h2>
            <p>{car.description || 'تفاصيل الإعلان متوفرة مباشرة من المعلن.'}</p>
          </section>

          {isCar && <section className="detail-section condition-report">
            <div className="inspection-heading"><div><span className="eyebrow eyebrow-green">شفافية من البائع</span><h2>الفحص الفني</h2></div><span className="inspection-caption">إجابات موثّقة في الإعلان</span></div>
            <div className="inspection-grid">
              <InspectionCard icon={<Wrench aria-hidden="true" />} title="زيارات الصيانة" answer={car.maintenanceVisited} details={car.maintenanceReason} />
              <InspectionCard icon={<ShieldCheck aria-hidden="true" />} title="إصلاح أو حادث" answer={car.repaired} details={car.repairDetails} />
              <InspectionCard icon={<Wrench aria-hidden="true" />} title="تغيير قطع أساسية" answer={car.partsChanged} details={car.changedParts} />
            </div>
          </section>}

          <div className="seller-card"><span className="seller-avatar">{car.sellerName?.slice(0, 1) || 'م'}</span><div><span>المعلن</span><strong>{car.sellerName || 'معلن مَسَار'}</strong>{car.verified && <span className="seller-verified">موثق من مَسَار ✓</span>}</div>{car.verified && <BadgeCheck aria-label="إعلان موثق من مَسَار" />}</div>
        </section>

        <aside className="detail-media-column" aria-label="صور الإعلان والتواصل">
          <div className="detail-photo-wrap">
            <ListingGallery images={images} title={itemTitle || itemType} />
            {(isCar ? (car.condition === 'new' ? 'جديدة' : 'مستعملة') : details.condition) && <span className="condition-badge detail-condition">{isCar ? (car.condition === 'new' ? 'جديدة' : 'مستعملة') : details.condition}</span>}
          </div>
          <div className="detail-contact-stack">
            {whatsappNumber ? <a className="whatsapp-button" href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer"><Phone aria-hidden="true" /> تواصل واتساب</a> : <button className="whatsapp-button" type="button" disabled><Phone aria-hidden="true" /> رقم التواصل غير متوفر</button>}
            {phone && !car.whatsappOnly && <a className="phone-button" href={`tel:${phone}`}><Phone aria-hidden="true" /> اتصال هاتفي</a>}
            <ShareListingButton />
            {canDelete && <ListingDetailActions listingId={car.id} isAdmin={isAdmin} />}
            <p className="secure-note"><BadgeCheck aria-hidden="true" /> الإعلان تمت مراجعته من فريق مَسَار</p>
          </div>
          <Link className="back-link" href="/">العودة إلى السوق <ArrowRight aria-hidden="true" /></Link>
        </aside>
      </div>
    </main>
  )
}
