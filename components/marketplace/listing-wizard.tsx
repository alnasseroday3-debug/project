'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Armchair, Camera, CarFront, Check, CheckCircle2, House, ImagePlus, PlugZap, ShieldCheck, Shirt, Smartphone, X } from 'lucide-react'
import { resubmitRejectedListing, submitListing } from '@/app/actions/listings'
import { compressImage, MAX_IMAGE_SOURCE_BYTES } from '@/lib/compress-image'
import { listingCategories, listingCategoryLabels, type ListingCategory, type ListingDetails } from '@/lib/listing-categories'

const steps = [
  { title: 'القسم والأساسيات', caption: 'اختر القسم وأدخل بيانات الإعلان' },
  { title: 'المواصفات', caption: 'تفاصيل القسم المختار' },
  { title: 'الصور والتواصل', caption: 'الصور وبيانات المعلن' },
]
const categoryIcons = { cars: CarFront, real_estate: House, furniture: Armchair, appliances: PlugZap, electronics: Smartphone, fashion: Shirt }

const currentYear = new Date().getFullYear()
const syrianGovernorates = ['دمشق', 'ريف دمشق', 'حلب', 'حمص', 'اللاذقية', 'طرطوس', 'حماة', 'إدلب', 'درعا', 'السويداء', 'دير الزور', 'الحسكة', 'الرقة', 'القنيطرة']
const carModels: Record<string, string[]> = {
  Toyota: ['Corolla', 'Camry', 'Prius', 'Yaris', 'RAV4', 'Land Cruiser', 'Hilux', 'Avanza'],
  Hyundai: ['Accent', 'Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'i10', 'i20'],
  Kia: ['Rio', 'Cerato', 'Optima', 'Sportage', 'Sorento', 'Picanto'],
  Nissan: ['Sunny', 'Altima', 'Sentra', 'Patrol', 'X-Trail', 'Qashqai'],
  Mercedes: ['C-Class', 'E-Class', 'S-Class', 'A-Class', 'GLC', 'GLE'],
  BMW: ['Series 3', 'Series 5', 'Series 7', 'X1', 'X3', 'X5'],
  Chevrolet: ['Cruze', 'Malibu', 'Aveo', 'Captiva', 'Tahoe'],
  Mitsubishi: ['Lancer', 'Pajero', 'Outlander', 'L200'],
  Volkswagen: ['Golf', 'Passat', 'Jetta', 'Tiguan', 'Touareg'],
  Renault: ['Logan', 'Symbol', 'Megane', 'Duster', 'Koleos'],
  Suzuki: ['Swift', 'Ciaz', 'Vitara', 'Jimny', 'Grand Vitara'],
  Ford: ['Focus', 'Fusion', 'Taurus', 'Explorer', 'Ranger'],
  Honda: ['Civic', 'Accord', 'CR-V', 'City'],
  Lexus: ['ES', 'IS', 'LS', 'RX', 'LX'],
  Jeep: ['Cherokee', 'Grand Cherokee', 'Wrangler', 'Compass'],
  Audi: ['A3', 'A4', 'A6', 'Q3', 'Q5', 'Q7'],
  Opel: ['Astra', 'Corsa', 'Insignia', 'Mokka'],
  Skoda: ['Octavia', 'Fabia', 'Superb', 'Kodiaq'],
  Peugeot: ['301', '308', '508', '2008', '3008'],
  MG: ['5', '6', 'ZS', 'HS'],
  Chery: ['Arrizo 5', 'Tiggo 4', 'Tiggo 7', 'Tiggo 8'],
  Geely: ['Emgrand', 'Coolray', 'Atlas'],
}
const makes = Object.keys(carModels)
const paintChoices = [
  { value: 'clean', label: 'خالية العلام جوا وبرا' },
  { value: 'interior', label: 'خالية من الداخل — زنار' },
  { value: 'panels', label: 'بخ قطعتين أو ثلاث' },
]
const transmissionChoices = [{ value: 'automatic', label: 'أوتوماتيك' }, { value: 'manual', label: 'عادي' }]
const fuelChoices = [
  { value: 'gasoline', label: 'بنزين' },
  { value: 'diesel', label: 'مازوت' },
  { value: 'hybrid', label: 'هايبرد' },
  { value: 'electric', label: 'كهرباء' },
]
const registrationChoices = [
  { value: 'syrian', label: 'نمرة سورية نظامية' },
  { value: 'new-entry', label: 'إدخال جديد' },
  { value: 'customs-cleared', label: 'مجمركة' },
  { value: 'immediate-transfer', label: 'فراغ فوري' },
]

function DetailSelect({ label, name, field, options, details, onChange, otherField }: {
  label: string
  name: string
  field: string
  options: string[]
  details: ListingDetails
  onChange: (field: string, value: string) => void
  otherField: string
}) {
  return (
    <>
      <label className="form-field"><span>{label}</span><select className="plain-input" name={name} value={details[field] ?? ''} onChange={(event) => onChange(field, event.target.value)} required><option value="">اختر {label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}<option value="other">أخرى (اكتب يدوياً)</option></select></label>
      {details[field] === 'other' && <label className="form-field"><span>{label} · كتابة يدوية</span><input className="plain-input" name={`${name}-other`} value={details[otherField] ?? ''} onChange={(event) => onChange(otherField, event.target.value)} placeholder={`اكتب ${label}`} maxLength={120} required /></label>}
    </>
  )
}

function ChoiceField({ label, name, value, options, onChange, className = '' }: {
  label: string
  name: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <fieldset className={`choice-field ${className}`}>
      <legend>{label}</legend>
      <div className="choice-options">
        {options.map((option) => (
          <label className={`choice-option${value === option.value ? ' is-selected' : ''}`} key={option.value}>
            <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} required />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

type ListingForEdit = {
  id: string
  make: string
  model: string
  category?: ListingCategory | null
  details?: ListingDetails | null
  year: number
  condition: 'new' | 'used'
  mileage: number
  mileageUnknown: boolean
  usageMonths: number | null
  maintenanceVisited: boolean
  maintenanceReason: string | null
  repaired: boolean
  repairDetails: string | null
  partsChanged: boolean
  changedParts: string | null
  askingPrice: number
  negotiationMin: number | null
  negotiationMax: number | null
  negotiable: boolean
  paintCondition: string | null
  paintDetails: string | null
  transmission: string | null
  fuelType: string | null
  registrationStatus: string | null
  whatsappOnly: boolean
  city: string | null
  description: string | null
  sellerPhone: string | null
  images: string[]
  hasVerificationImage: boolean
}

export function ListingWizard({ userId, userName, existingListing }: { userId: string; userName: string; existingListing?: ListingForEdit }) {
  const router = useRouter()
  const isEditing = Boolean(existingListing)
  const draftStorageKey = `masar-listing-draft-v1:${userId}`
  const [step, setStep] = useState(0)
  const [category, setCategory] = useState<ListingCategory>(existingListing?.category ?? 'cars')
  const [details, setDetails] = useState<ListingDetails>(existingListing?.details ?? {})
  const [make, setMake] = useState(existingListing?.make ?? '')
  const [makeChoice, setMakeChoice] = useState(existingListing ? (makes.includes(existingListing.make) ? existingListing.make : existingListing.make ? 'other' : '') : '')
  const [model, setModel] = useState(existingListing?.model ?? '')
  const [customModelActive, setCustomModelActive] = useState(Boolean(existingListing?.model && !carModels[existingListing.make]?.includes(existingListing.model)))
  const [year, setYear] = useState(String(existingListing?.year ?? currentYear))
  const [condition, setCondition] = useState<'new' | 'used'>(existingListing?.condition ?? 'used')
  const [mileage, setMileage] = useState(String(existingListing?.mileage ?? ''))
  const [mileageUnknown, setMileageUnknown] = useState(existingListing?.mileageUnknown ?? false)
  const [usageMonths, setUsageMonths] = useState(String(existingListing?.usageMonths ?? ''))
  const [negotiable, setNegotiable] = useState(existingListing?.negotiable ?? Boolean(existingListing?.negotiationMin || existingListing?.negotiationMax))
  const [paintCondition, setPaintCondition] = useState(existingListing ? existingListing.paintCondition ?? '' : 'clean')
  const [paintDetails, setPaintDetails] = useState(existingListing?.paintDetails ?? '')
  const [transmission, setTransmission] = useState(existingListing ? existingListing.transmission ?? '' : 'automatic')
  const [fuelType, setFuelType] = useState(existingListing ? existingListing.fuelType ?? '' : 'gasoline')
  const [registrationStatus, setRegistrationStatus] = useState(existingListing ? existingListing.registrationStatus ?? '' : 'syrian')
  const [whatsappOnly, setWhatsappOnly] = useState(existingListing?.whatsappOnly ?? false)
  const [maintenanceVisited, setMaintenanceVisited] = useState(existingListing ? (existingListing.maintenanceVisited ? 'yes' : 'no') : 'yes')
  const [maintenanceReason, setMaintenanceReason] = useState(existingListing?.maintenanceReason ?? '')
  const [repaired, setRepaired] = useState(existingListing ? (existingListing.repaired ? 'yes' : 'no') : 'no')
  const [repairDetails, setRepairDetails] = useState(existingListing?.repairDetails ?? '')
  const [partsChanged, setPartsChanged] = useState(existingListing ? (existingListing.partsChanged ? 'yes' : 'no') : 'no')
  const [changedParts, setChangedParts] = useState(existingListing?.changedParts ?? '')
  const [askingPrice, setAskingPrice] = useState(String(existingListing?.askingPrice ?? ''))
  const [negotiationMin, setNegotiationMin] = useState(String(existingListing?.negotiationMin ?? ''))
  const [negotiationMax, setNegotiationMax] = useState(String(existingListing?.negotiationMax ?? ''))
  const [city, setCity] = useState(existingListing?.city ?? '')
  const [description, setDescription] = useState(existingListing?.description ?? '')
  const [sellerPhone, setSellerPhone] = useState(existingListing?.sellerPhone ?? '')
  const [existingImages, setExistingImages] = useState<string[]>(existingListing?.images ?? [])
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [verificationFile, setVerificationFile] = useState<File | null>(null)
  const [verificationPreview, setVerificationPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const makeIsKnown = makes.includes(make)
  const makeOptionValue = makeIsKnown ? make : make ? 'other' : makeChoice
  const showCustomMake = makeOptionValue === 'other'
  const modelOptions = carModels[make] ?? []
  const useCustomModel = customModelActive || Boolean(model && !modelOptions.includes(model))
  const selectedModel = modelOptions.includes(model) ? model : ''
  const existingCityNotListed = Boolean(existingListing?.city && !syrianGovernorates.includes(existingListing.city))

  useEffect(() => {
    if (isEditing) {
      setDraftLoaded(true)
      return
    }
    try {
      const storedDraft = window.localStorage.getItem(draftStorageKey)
      if (storedDraft) {
        const draft: unknown = JSON.parse(storedDraft)
        if (draft && typeof draft === 'object') {
          const values = draft as Record<string, unknown>
          if (typeof values.category === 'string' && listingCategories.some((item) => item.id === values.category)) setCategory(values.category as ListingCategory)
          if (values.details && typeof values.details === 'object' && !Array.isArray(values.details)) setDetails(values.details as ListingDetails)
          if (typeof values.make === 'string') setMake(values.make)
          if (typeof values.model === 'string') setModel(values.model)
          if (typeof values.year === 'string') setYear(values.year)
          if (values.condition === 'new' || values.condition === 'used') setCondition(values.condition)
          if (typeof values.mileage === 'string') setMileage(values.mileage)
          if (typeof values.usageMonths === 'string') setUsageMonths(values.usageMonths)
          if (values.maintenanceVisited === 'yes' || values.maintenanceVisited === 'no') setMaintenanceVisited(values.maintenanceVisited)
          if (typeof values.maintenanceReason === 'string') setMaintenanceReason(values.maintenanceReason)
          if (values.repaired === 'yes' || values.repaired === 'no') setRepaired(values.repaired)
          if (typeof values.repairDetails === 'string') setRepairDetails(values.repairDetails)
          if (values.partsChanged === 'yes' || values.partsChanged === 'no') setPartsChanged(values.partsChanged)
          if (typeof values.changedParts === 'string') setChangedParts(values.changedParts)
          if (typeof values.askingPrice === 'string') setAskingPrice(values.askingPrice)
          if (typeof values.negotiationMin === 'string') setNegotiationMin(values.negotiationMin)
          if (typeof values.negotiationMax === 'string') setNegotiationMax(values.negotiationMax)
          if (typeof values.city === 'string') setCity(values.city)
          if (typeof values.description === 'string') setDescription(values.description)
          if (typeof values.sellerPhone === 'string') setSellerPhone(values.sellerPhone)
        }
      }
    } catch {
      // Storage can be unavailable in private browsing; the form remains usable.
    }
    setDraftLoaded(true)
  }, [draftStorageKey, isEditing])

  useEffect(() => {
    if (!draftLoaded || isEditing || complete) return
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify({
        category, details, make, model, year, condition, mileage, usageMonths, maintenanceVisited, maintenanceReason,
        repaired, repairDetails, partsChanged, changedParts, askingPrice, negotiationMin,
        negotiationMax, city, description, sellerPhone,
      }))
    } catch {
      return
    }
  }, [askingPrice, category, changedParts, city, complete, condition, description, details, draftLoaded, draftStorageKey, isEditing, make, maintenanceReason, maintenanceVisited, mileage, model, negotiationMax, negotiationMin, partsChanged, repaired, repairDetails, sellerPhone, usageMonths, year])

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])
  useEffect(() => () => {
    if (verificationPreview) URL.revokeObjectURL(verificationPreview)
  }, [verificationPreview])

  function setDetail(field: string, value: string) {
    setDetails((current) => ({ ...current, [field]: value }))
  }

  function getSelectedItemType() {
    if (category === 'real_estate') return details.propertyType === 'other' ? details.propertyTypeOther ?? '' : details.propertyType ?? ''
    return details.itemType === 'other' ? details.itemTypeOther ?? '' : details.itemType ?? ''
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const selected = Array.from(input.files || [])
    if (selected.length + existingImages.length > 8) {
      setError('يمكنك الاحتفاظ بما مجموعه 8 صور كحد أقصى.')
      input.value = ''
      return
    }
    if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_IMAGE_SOURCE_BYTES)) {
      setError('اختر صور JPG أو PNG أو WebP بحجم أصلي لا يتجاوز 20 ميغابايت للصورة.')
      input.value = ''
      return
    }

    setError('')
    setCompressing(true)
    try {
      const compressedFiles: File[] = []
      for (const file of selected) compressedFiles.push(await compressImage(file))
      setFiles(compressedFiles)
      setPreviews(compressedFiles.map((file) => URL.createObjectURL(file)))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر ضغط الصور. جرّب صوراً أخرى.')
      input.value = ''
    } finally {
      setCompressing(false)
    }
  }

  function removeImage(index: number) {
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))
    setPreviews((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  function removeExistingImage(index: number) {
    setExistingImages((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  async function handleVerificationFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > MAX_IMAGE_SOURCE_BYTES) {
      setError('صورة التحقق يجب أن تكون JPG أو PNG أو WebP وبحجم أصلي لا يتجاوز 20 ميغابايت.')
      input.value = ''
      return
    }

    setError('')
    setCompressing(true)
    try {
      const compressedFile = await compressImage(file)
      setVerificationFile(compressedFile)
      setVerificationPreview(URL.createObjectURL(compressedFile))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر ضغط صورة التحقق. جرّب صورة أخرى.')
      input.value = ''
    } finally {
      setCompressing(false)
    }
  }

  function goNext() {
    const stepElement = document.getElementById(`listing-step-${step}`)
    const controls = stepElement?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')
    for (const control of Array.from(controls || [])) {
      if (!control.reportValidity()) return
    }
    setError('')
    setStep((current) => Math.min(current + 1, steps.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const imageCount = existingImages.length + files.length
    const hasVerificationImage = Boolean(existingListing?.hasVerificationImage || verificationFile)
    if (busy || compressing || imageCount === 0 || !hasVerificationImage) {
      if (imageCount === 0) setError('أضف صورة واحدة على الأقل للإعلان.')
      else if (!hasVerificationImage) setError('أضف صورة التحقق وإثبات الجدية للمتابعة.')
      return
    }
    setBusy(true)
    setError('')

    try {
      const imagePaths = [...existingImages]
      for (const file of files) {
        const uploadForm = new FormData()
        uploadForm.append('file', file)
        uploadForm.append('kind', 'car')
        const response = await fetch('/api/uploads', { method: 'POST', body: uploadForm })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'تعذّر رفع الصور.')
        imagePaths.push(result.url)
      }

      if (verificationFile) {
        const verificationForm = new FormData()
        verificationForm.append('file', verificationFile)
        verificationForm.append('kind', 'verification')
        const verificationResponse = await fetch('/api/uploads', { method: 'POST', body: verificationForm })
        const verificationResult = await verificationResponse.json()
        if (!verificationResponse.ok) throw new Error(verificationResult.error || 'تعذّر رفع صورة التحقق.')
      }

      const categoryCondition = category === 'real_estate' ? details.propertyCondition : details.condition
      const submittedDetails = category === 'real_estate'
        ? { ...details, district: details.district ?? '', condition: details.propertyCondition ?? '' }
        : { ...details, district: details.district ?? '' }
      const draft = {
        category,
        details: submittedDetails,
        make,
        model: category === 'cars' ? model : getSelectedItemType(),
        year: category === 'cars' ? Number(year) : currentYear,
        condition: category === 'cars' ? condition : categoryCondition === 'جديد' ? 'new' as const : 'used' as const,
        mileage: category === 'cars' && condition === 'used' && !mileageUnknown ? Number(mileage) : 0,
        mileageUnknown: category === 'cars' && condition === 'used' && mileageUnknown,
        usageMonths: category === 'cars' && condition === 'used' ? Number(usageMonths || 0) : 0,
        maintenanceVisited: category === 'cars' && maintenanceVisited === 'yes',
        maintenanceReason: category === 'cars' ? maintenanceReason : '',
        repaired: category === 'cars' && repaired === 'yes',
        repairDetails: category === 'cars' ? repairDetails : '',
        partsChanged: category === 'cars' && partsChanged === 'yes',
        changedParts: category === 'cars' ? changedParts : '',
        askingPrice: Number(askingPrice),
        negotiationMin: category === 'cars' && negotiable && negotiationMin ? Number(negotiationMin) : null,
        negotiationMax: category === 'cars' && negotiable && negotiationMax ? Number(negotiationMax) : null,
        negotiable: category === 'cars' && negotiable,
        paintCondition: category === 'cars' ? paintCondition : '',
        paintDetails: category === 'cars' ? paintDetails : '',
        transmission: category === 'cars' ? transmission : '',
        fuelType: category === 'cars' ? fuelType : '',
        registrationStatus: category === 'cars' ? registrationStatus : '',
        whatsappOnly,
        city,
        description,
        sellerPhone,
        images: imagePaths,
        verificationImageUpdated: Boolean(verificationFile),
      }
      const result = existingListing
        ? await resubmitRejectedListing(existingListing.id, draft)
        : await submitListing(draft)
      if (!result.success) throw new Error(result.message)
      if (!isEditing) {
        try {
          window.localStorage.removeItem(draftStorageKey)
        } catch {
          // The listing is already submitted; storage cleanup must not undo success.
        }
      }
      setComplete(true)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر إرسال الإعلان.')
    } finally {
      setBusy(false)
    }
  }

  if (complete) {
    return (
      <main className="wizard-page page-container">
        <section className="submission-success">
          <span className="success-icon"><CheckCircle2 aria-hidden="true" /></span>
          <span className="eyebrow eyebrow-green">وصلنا إعلانك يا {userName.split(' ')[0]}</span>
          <h1>{isEditing ? 'عاد إعلانك للمراجعة.' : 'خطوة وتكمل الحكاية.'}</h1>
          <p>{isEditing ? 'تم حفظ التعديلات وإرسال الإعلان مجدداً إلى فريق مَسَار.' : 'إعلانك الآن عند فريق مَسَار للمراجعة. بنخبرك أول ما يصير جاهزاً للعرض.'}</p>
          <div className="success-actions"><Link className="primary-button" href={isEditing ? '/my-listings' : '/'}>{isEditing ? 'العودة إلى إعلاناتي' : 'العودة للسوق'} <ArrowLeft aria-hidden="true" /></Link></div>
        </section>
      </main>
    )
  }

  return (
    <main className="wizard-page page-container">
      <div className="wizard-breadcrumb"><Link href="/">الرئيسية</Link><span>/</span><Link href="/my-listings">إعلاناتي</Link><span>/</span><span>{isEditing ? 'تعديل وإعادة إرسال' : 'أضف إعلانك'}</span></div>
      <div className="wizard-heading"><div><span className="eyebrow eyebrow-green">{isEditing ? 'تعديل إعلان مرفوض' : 'إعلان جديد'}</span><h1>{isEditing ? 'حدّث تفاصيل إعلانك.' : 'خلّ إعلانك يلقى طريقه.'}</h1><p>{isEditing ? 'صحّح التفاصيل أو حدّث الصور، ثم أعد إرسال الإعلان للمراجعة.' : 'اختر القسم المناسب، أضف التفاصيل، وفريقنا يتولى المراجعة قبل النشر.'}</p></div><div className="wizard-trust"><ShieldCheck aria-hidden="true" /><span>مراجعة مجانية<br /><strong>قبل النشر</strong></span></div></div>

      <div className="wizard-layout">
        <aside className="wizard-steps" aria-label="مراحل إضافة الإعلان">
          {steps.map((item, index) => (
            <div key={item.title} className={`wizard-step${index === step ? ' is-current' : ''}${index < step ? ' is-complete' : ''}`}>
              <span className="step-number">{index < step ? <Check aria-hidden="true" /> : `0${index + 1}`}</span>
              <span><strong>{item.title}</strong><small>{item.caption}</small></span>
            </div>
          ))}
          <div className="wizard-side-note"><span className="note-spark">م</span><p>كلما كانت التفاصيل أوضح، صار قرار المشتري أسهل.</p></div>
        </aside>

        <form className="wizard-form" onSubmit={handleSubmit} noValidate>
          <div className="wizard-form-top"><span>الخطوة {String(step + 1).padStart(2, '0')} من 03</span><span>{steps[step].caption}</span></div>
          {!isEditing && <p className="draft-save-note" role="status">تُحفظ تفاصيل الإعلان تلقائياً على هذا الجهاز.</p>}
          <div className="wizard-progress"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>

          <div id="listing-step-0" hidden={step !== 0}>
            <div className="form-section-heading"><span className="eyebrow eyebrow-green">الخطوة الأولى · اختر القسم أولاً</span><h2>ما الإعلان الذي تريد إضافته؟</h2><p>ستظهر لك مواصفات مناسبة للقسم الذي تختاره في الخطوة التالية.</p></div>
            <fieldset className="listing-category-picker"><legend>القسم الرئيسي</legend><div className="listing-category-options">{listingCategories.map((item) => { const Icon = categoryIcons[item.id]; return <button key={item.id} type="button" className={category === item.id ? 'listing-category-option is-selected' : 'listing-category-option'} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}><Icon aria-hidden="true" /><span>{item.label}</span></button> })}</div></fieldset>
            <div className="form-grid">
              {category === 'cars' ? <>
                <label className="form-field"><span>الشركة المصنّعة</span><select className="plain-input" value={makeOptionValue} onChange={(event) => { const value = event.target.value; setMakeChoice(value); setMake(value === 'other' ? '' : value); setModel(''); setCustomModelActive(false) }} required><option value="">اختر الماركة</option>{makes.map((item) => <option value={item} key={item}>{item}</option>)}<option value="other">ماركة أخرى</option></select></label>
                {showCustomMake && <label className="form-field"><span>اكتب الماركة</span><input className="plain-input" value={make} onChange={(event) => { setMake(event.target.value); setModel(''); setCustomModelActive(false) }} placeholder="اسم الشركة المصنّعة" required maxLength={50} /></label>}
                {makeIsKnown ? <label className="form-field"><span>الموديل</span>{!useCustomModel ? <select className="plain-input" value={selectedModel} onChange={(event) => { const value = event.target.value; setModel(value === 'other' ? '' : value); setCustomModelActive(value === 'other') }} required><option value="">اختر الموديل</option>{modelOptions.map((item) => <option value={item} key={item}>{item}</option>)}<option value="other">موديل آخر</option></select> : <input className="plain-input" value={model} onChange={(event) => setModel(event.target.value)} placeholder="اكتب الموديل" required maxLength={60} />}</label> : <label className="form-field"><span>الموديل</span><input className="plain-input" value={model} onChange={(event) => setModel(event.target.value)} placeholder="اكتب الموديل" required maxLength={60} disabled={!make.trim()} /></label>}
                <label className="form-field"><span>سنة الصنع</span><select className="plain-input" value={year} onChange={(event) => setYear(event.target.value)} required><option value="">اختر السنة</option>{Array.from({ length: currentYear + 2 - 1980 }, (_, index) => currentYear + 1 - index).map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
                <ChoiceField label="حالة السيارة" name="condition" value={condition} options={[{ value: 'used', label: 'مستعملة' }, { value: 'new', label: 'جديدة زيرو' }]} onChange={(value) => setCondition(value as 'new' | 'used')} className="form-field-wide" />
                {condition === 'used' && <>
                  <label className="form-field"><span>الممشى (العداد بالكم)</span><input className="plain-input" type="number" inputMode="numeric" min="0" max="2000000" value={mileage} onChange={(event) => setMileage(event.target.value)} placeholder="مثال: 32,000" required={!mileageUnknown} disabled={mileageUnknown} /></label>
                  <label className="form-checkbox mileage-unknown"><input type="checkbox" checked={mileageUnknown} onChange={(event) => setMileageUnknown(event.target.checked)} /><span>العداد متوقف / لا أعلم</span></label>
                  <label className="form-field"><span>مدة الاستخدام <small>اختياري · بالأشهر</small></span><input className="plain-input" type="number" inputMode="numeric" min="0" max="1200" value={usageMonths} onChange={(event) => setUsageMonths(event.target.value)} placeholder="مثال: 24" /></label>
                </>}
              </> : <label className="form-field form-field-wide"><span>اسم الإعلان</span><input className="plain-input" value={make} onChange={(event) => setMake(event.target.value)} placeholder="مثال: شقة بإطلالة على المدينة أو طقم كنب" maxLength={80} required /></label>}
              <label className="form-field"><span>السعر بالدولار الأمريكي ($)</span><input className="plain-input" type="number" inputMode="numeric" min={category === 'cars' ? 1000 : 1} max="100000000" value={askingPrice} onChange={(event) => setAskingPrice(event.target.value)} placeholder="أدخل السعر بالدولار" required /></label>
              <label className="form-checkbox negotiable-toggle"><input type="checkbox" checked={negotiable} onChange={(event) => setNegotiable(event.target.checked)} /><span>السعر قابل للتفاوض</span></label>
              <label className="form-field"><span>المحافظة</span><select className="plain-input" value={city} onChange={(event) => setCity(event.target.value)} required><option value="">اختر المحافظة</option>{syrianGovernorates.map((governorate) => <option value={governorate} key={governorate}>{governorate}</option>)}{existingCityNotListed && <option value={city}>{city} (القيمة الحالية)</option>}</select></label>
              <label className="form-field"><span>المنطقة <small>اختياري</small></span><input className="plain-input" value={details.district ?? ''} onChange={(event) => setDetail('district', event.target.value)} placeholder="مثال: المزة، الشهباء، أو وسط المدينة" maxLength={60} /></label>
            </div>
          </div>

          <div id="listing-step-1" hidden={step !== 1}>
            <div className="form-section-heading"><span className="eyebrow eyebrow-green">الخطوة الثانية · مواصفات {listingCategoryLabels[category]}</span><h2>تفاصيل تهمّ المشتري.</h2><p>{category === 'cars' ? 'اختيارات السوق السوري الحالية كما هي، مع مساحة لإضافة التفاصيل.' : 'اختر من القوائم لتوضيح إعلانك، أو استخدم الكتابة اليدوية عند الحاجة.'}</p></div>
            {category === 'cars' ? <>
              <div className="form-grid market-specs-grid">
                <ChoiceField label="حالة البخ (الدهان)" name="paintCondition" value={paintCondition} options={paintChoices} onChange={setPaintCondition} className="form-field-wide" />
                {paintCondition !== 'clean' && <label className="form-field form-field-wide"><span>مكان البخ أو ملاحظات الدهان <small>اختياري</small></span><input className="plain-input" value={paintDetails} onChange={(event) => setPaintDetails(event.target.value)} placeholder="مثال: باب أمامي يمين ورفرف خلفي" maxLength={250} /></label>}
                <ChoiceField label="نوع الغيار (الفيتيس)" name="transmission" value={transmission} options={transmissionChoices} onChange={setTransmission} />
                <ChoiceField label="نوع الوقود" name="fuelType" value={fuelType} options={fuelChoices} onChange={setFuelType} />
                <ChoiceField label="حالة الأوراق والنمرة" name="registrationStatus" value={registrationStatus} options={registrationChoices} onChange={setRegistrationStatus} className="form-field-wide" />
              </div>
              <section className="seller-transparency">
                <div className="seller-transparency-heading"><span className="eyebrow eyebrow-green">شفافية من البائع</span><h3>سجل الصيانة والحالة الفنية</h3></div>
                <div className="form-grid">
                  <ChoiceField label="هل زارت السيارة مراكز الصيانة؟" name="maintenanceVisited" value={maintenanceVisited} options={[{ value: 'yes', label: 'نعم' }, { value: 'no', label: 'لا' }]} onChange={setMaintenanceVisited} />
                  <ChoiceField label="هل سبق إصلاح السيارة؟" name="repaired" value={repaired} options={[{ value: 'no', label: 'لا' }, { value: 'yes', label: 'نعم' }]} onChange={setRepaired} />
                  <ChoiceField label="هل تم تغيير أي قطع؟" name="partsChanged" value={partsChanged} options={[{ value: 'no', label: 'لا' }, { value: 'yes', label: 'نعم' }]} onChange={setPartsChanged} />
                  {maintenanceVisited === 'yes' && <label className="form-field form-field-wide"><span>ما سبب زيارات الصيانة؟</span><textarea className="plain-input plain-textarea" value={maintenanceReason} onChange={(event) => setMaintenanceReason(event.target.value)} placeholder="مثال: صيانة دورية كل 10,000 كم" maxLength={500} /></label>}
                  {repaired === 'yes' && <label className="form-field form-field-wide"><span>تفاصيل الإصلاح</span><textarea className="plain-input plain-textarea" value={repairDetails} onChange={(event) => setRepairDetails(event.target.value)} placeholder="اذكر الإصلاحات وتوقيتها إن أمكن" maxLength={500} required /></label>}
                  {partsChanged === 'yes' && <label className="form-field form-field-wide"><span>ما القطع التي تم تغييرها؟</span><textarea className="plain-input plain-textarea" value={changedParts} onChange={(event) => setChangedParts(event.target.value)} placeholder="مثال: بطارية، إطارات..." maxLength={500} required /></label>}
                </div>
              </section>
            </> : <div className="form-grid market-specs-grid dynamic-specs-grid">
              {category === 'real_estate' && <>
                <DetailSelect label="نوع العقار" name="propertyType" field="propertyType" otherField="propertyTypeOther" details={details} onChange={setDetail} options={['شقة', 'بيت عربي', 'مزرعة', 'محل تجاري', 'أرض']} />
                <label className="form-field"><span>المساحة بالمتر المربع</span><input className="plain-input" type="number" min="1" inputMode="numeric" value={details.areaSqm ?? ''} onChange={(event) => setDetail('areaSqm', event.target.value)} placeholder="مثال: 120" required /></label>
                <label className="form-field"><span>عدد الغرف</span><input className="plain-input" type="number" min="0" inputMode="numeric" value={details.rooms ?? ''} onChange={(event) => setDetail('rooms', event.target.value)} placeholder="مثال: 3" required /></label>
                <label className="form-field"><span>الطابق</span><input className="plain-input" value={details.floor ?? ''} onChange={(event) => setDetail('floor', event.target.value)} placeholder="مثال: أرضي، أول، أو طابق 3" maxLength={40} required /></label>
                <ChoiceField label="حالة العقار" name="propertyCondition" value={details.propertyCondition ?? ''} options={['سوبر ديلوكس', 'على العضم', 'مفروش', 'عادي'].map((value) => ({ value, label: value }))} onChange={(value) => setDetail('propertyCondition', value)} />
                <DetailSelect label="نوع الملكية" name="ownershipType" field="ownershipType" otherField="ownershipOther" details={details} onChange={setDetail} options={['طابو أخضر', 'حكم محكمة', 'كاتب عدل']} />
              </>}
              {category === 'furniture' && <>
                <DetailSelect label="نوع الأثاث" name="furnitureType" field="itemType" otherField="itemTypeOther" details={details} onChange={setDetail} options={['غرفة نوم', 'طقم كنب', 'سفرة', 'مطبخ', 'سجاد وموكيت', 'مكاتب']} />
                <ChoiceField label="الحالة" name="furnitureCondition" value={details.condition ?? ''} options={['جديد', 'مستعمل نظيف', 'مستعمل'].map((value) => ({ value, label: value }))} onChange={(value) => setDetail('condition', value)} />
              </>}
              {category === 'appliances' && <>
                <DetailSelect label="نوع الأداة" name="applianceType" field="itemType" otherField="itemTypeOther" details={details} onChange={setDetail} options={['براد', 'غسالة', 'مكيف', 'شاشة', 'غاز/فرن', 'منظومة طاقة شمسية/بطاريات/إنفرتر']} />
                <label className="form-field"><span>الماركة</span><input className="plain-input" value={details.brand ?? ''} onChange={(event) => setDetail('brand', event.target.value)} placeholder="اكتب الماركة" maxLength={80} required /></label>
                <ChoiceField label="الحالة" name="applianceCondition" value={details.condition ?? ''} options={['جديد', 'مستعمل'].map((value) => ({ value, label: value }))} onChange={(value) => setDetail('condition', value)} />
              </>}
              {category === 'electronics' && <>
                <DetailSelect label="نوع الجهاز" name="electronicsType" field="itemType" otherField="itemTypeOther" details={details} onChange={setDetail} options={['موبايل', 'لابتوب', 'كمبيوتر', 'تابلت', 'بلايستيشن وألعاب', 'كاميرات وإكسسوارات']} />
                <label className="form-field"><span>السعة أو المواصفات</span><input className="plain-input" value={details.specifications ?? ''} onChange={(event) => setDetail('specifications', event.target.value)} placeholder="مثال: 256 جيجابايت، ذاكرة 16 جيجابايت" maxLength={150} required /></label>
                <ChoiceField label="الحالة" name="electronicsCondition" value={details.condition ?? ''} options={['جديد', 'مستعمل نظيف'].map((value) => ({ value, label: value }))} onChange={(value) => setDetail('condition', value)} />
              </>}
              {category === 'fashion' && <>
                <DetailSelect label="نوع الملابس أو المنتجات" name="fashionType" field="itemType" otherField="itemTypeOther" details={details} onChange={setDetail} options={['رجالي', 'نسائي', 'أطفال', 'أحذية وحقائب', 'بالة أوروبية']} />
                <ChoiceField label="صفة البائع" name="sellerType" value={details.sellerType ?? ''} options={['فرد', 'محل تجاري', 'مول'].map((value) => ({ value, label: value }))} onChange={(value) => setDetail('sellerType', value)} />
                <label className="form-field"><span>المقاسات</span><select className="plain-input" value={details.size ?? ''} onChange={(event) => setDetail('size', event.target.value)} required><option value="">اختر المقاس</option>{['XS', 'S', 'M', 'L', 'XL', 'XXL', 'مقاس موحد', 'تشكيلة مقاسات متنوعة'].map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
                <ChoiceField label="الحالة" name="fashionCondition" value={details.condition ?? ''} options={['جديد', 'بالة فرز أول', 'مستعمل'].map((value) => ({ value, label: value }))} onChange={(value) => setDetail('condition', value)} />
              </>}
            </div>}
          </div>

          <div id="listing-step-2" hidden={step !== 2}>
            <div className="form-section-heading"><span className="eyebrow eyebrow-green">الخطوة الثالثة · الصور والتواصل</span><h2>خلّ إعلانك ينشاف.</h2><p>الصور الواضحة والتواصل السهل يساعدانك على البيع أسرع.</p></div>
            <p className="upload-advice">أضف صوراً واضحة للمنتج أو العقار أو المركبة لبيع أسرع.</p>
            <label className="upload-dropzone">
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={compressing || busy} onChange={handleFiles} aria-label="اختر صور الإعلان" />
              <span className="upload-icon"><ImagePlus aria-hidden="true" /></span>
              <strong>اسحب الصور هنا أو اخترها من جهازك</strong>
              <small>حتى 8 صور · المحفوظ: {existingImages.length} · تُضغط الصور الجديدة تلقائياً إلى أقل من 500 كيلوبايت للصورة</small>
              <span className="upload-button"><Camera aria-hidden="true" /> اختيار الصور</span>
            </label>
            {(existingImages.length > 0 || previews.length > 0) && <div className="image-preview-grid">
              {existingImages.map((image, index) => <div className="image-preview" key={`existing-${image}`}><Image src={image} alt={`صورة السيارة المحفوظة ${index + 1}`} width={240} height={180} unoptimized /><button type="button" aria-label={`إزالة الصورة المحفوظة ${index + 1}`} onClick={() => removeExistingImage(index)}><X aria-hidden="true" /></button></div>)}
              {previews.map((preview, index) => <div className="image-preview" key={preview}><Image src={preview} alt={`معاينة صورة السيارة الجديدة ${index + 1}`} width={240} height={180} unoptimized /><button type="button" aria-label={`حذف الصورة الجديدة ${index + 1}`} onClick={() => removeImage(index)}><X aria-hidden="true" /></button></div>)}
            </div>}
            <div className="upload-privacy"><ShieldCheck aria-hidden="true" /><span>صور الإعلان ستظهر للمشترين بعد الموافقة على الإعلان.</span></div>
            <div className="form-grid contact-fields">
              <label className="form-field form-field-wide"><span>رقم واتساب للتواصل <small>مطلوب</small></span><input className="plain-input" type="tel" inputMode="tel" value={sellerPhone} onChange={(event) => setSellerPhone(event.target.value)} placeholder="+963 9XX XXX XXX" pattern="\+?[0-9\s()-]{8,20}" required /></label>
              <label className="form-checkbox form-field-wide"><input type="checkbox" checked={whatsappOnly} onChange={(event) => setWhatsappOnly(event.target.checked)} /><span>التواصل عبر واتساب فقط</span></label>
              <label className="form-field form-field-wide"><span>ملاحظات إضافية <small>اختياري</small></span><textarea className="plain-input plain-textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="أضف أي تفاصيل تهم المشتري" maxLength={1200} /></label>
            </div>
            <label className="upload-dropzone verification-upload">
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={compressing || busy} onChange={handleVerificationFile} aria-label="صورة التحقق وإثبات الجدية" required={!existingListing?.hasVerificationImage} />
              <span className="upload-icon"><ShieldCheck aria-hidden="true" /></span>
              <strong>صورة التحقق وإثبات الجدية <span aria-hidden="true">(مطلوبة)</span></strong>
              <small>{category === 'cars' ? 'صوّر السيارة مع ورقة مكتوب عليها «مسار» وتاريخ اليوم، أو صورة لميكانيك السيارة مع إخفاء المعلومات الشخصية.' : 'أرفق صورة تثبت توفر المنتج أو العقار، مع إخفاء أي معلومات شخصية غير لازمة.'} تُضغط الصورة تلقائياً لأقل من 500 كيلوبايت.</small>
              <span className="upload-button"><Camera aria-hidden="true" /> {verificationFile ? 'تغيير صورة التحقق' : 'اختيار صورة التحقق'}</span>
            </label>
            {existingListing?.hasVerificationImage && !verificationFile && <p className="existing-verification-note"><ShieldCheck aria-hidden="true" /> صورة التحقق الحالية محفوظة. يمكنك الاحتفاظ بها أو رفع صورة أوضح لاستبدالها.</p>}
            {verificationPreview && <div className="verification-preview"><Image src={verificationPreview} alt="معاينة صورة التحقق التي ستظهر للإدارة فقط" width={480} height={320} unoptimized /><span>صورة خاصة بالإدارة فقط</span></div>}
            <div className="upload-privacy verification-privacy"><ShieldCheck aria-hidden="true" /><span>هذه الصورة لا تُنشر للعامة، ولا يطّلع عليها إلا فريق إدارة مَسَار للمراجعة.</span></div>
          </div>


          {error && <p className="form-alert wizard-alert" role="alert">{error}</p>}
          <div className="wizard-actions">
            {step > 0 ? <button className="wizard-back" type="button" onClick={() => { setError(''); setStep((current) => current - 1) }}><ArrowRight aria-hidden="true" /> رجوع</button> : <span />}
            {step < steps.length - 1 ? <button className="primary-button wizard-next" type="button" onClick={goNext}>الخطوة التالية <ArrowLeft aria-hidden="true" /></button> : <button className="primary-button wizard-next" type="submit" disabled={busy || compressing || existingImages.length + files.length === 0 || (!existingListing?.hasVerificationImage && !verificationFile)}>{compressing ? 'جارٍ ضغط الصور…' : busy ? 'جارٍ رفع الصور…' : isEditing ? 'إعادة الإرسال للمراجعة' : 'إرسال للمراجعة'} {busy || compressing ? <span className="button-spinner" /> : <ArrowLeft aria-hidden="true" />}</button>}
          </div>
        </form>
      </div>
      <div className="wizard-bottom-note"><CheckCircle2 aria-hidden="true" /> إعلانك لن يظهر للناس إلا بعد مراجعة فريق مَسَار.</div>
    </main>
  )
}
