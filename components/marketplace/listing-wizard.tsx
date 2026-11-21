'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ImagePlus, ShieldCheck, X } from 'lucide-react'
import { submitListing } from '@/app/actions/listings'

const steps = [
  { title: 'السيارة', caption: 'التفاصيل الأساسية' },
  { title: 'السجل', caption: 'الصيانة والحالة' },
  { title: 'السعر', caption: 'السعر والموقع' },
  { title: 'الصور', caption: 'اللمسات الأخيرة' },
]

const currentYear = new Date().getFullYear()

export function ListingWizard({ userName }: { userName: string }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState(String(currentYear))
  const [condition, setCondition] = useState<'new' | 'used'>('used')
  const [mileage, setMileage] = useState('')
  const [usageMonths, setUsageMonths] = useState('')
  const [maintenanceVisited, setMaintenanceVisited] = useState('yes')
  const [maintenanceReason, setMaintenanceReason] = useState('')
  const [repaired, setRepaired] = useState('no')
  const [repairDetails, setRepairDetails] = useState('')
  const [partsChanged, setPartsChanged] = useState('no')
  const [changedParts, setChangedParts] = useState('')
  const [askingPrice, setAskingPrice] = useState('')
  const [negotiationMin, setNegotiationMin] = useState('')
  const [negotiationMax, setNegotiationMax] = useState('')
  const [city, setCity] = useState('')
  const [description, setDescription] = useState('')
  const [sellerPhone, setSellerPhone] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || [])
    if (selected.length > 6) {
      setError('يمكنك رفع 6 صور كحد أقصى.')
      event.target.value = ''
      return
    }
    if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024)) {
      setError('اختر صور JPG أو PNG أو WebP، بحجم أقل من 4 ميغابايت للصورة.')
      event.target.value = ''
      return
    }
    setError('')
    setFiles(selected)
    setPreviews(selected.map((file) => URL.createObjectURL(file)))
  }

  function removeImage(index: number) {
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))
    setPreviews((current) => current.filter((_, currentIndex) => currentIndex !== index))
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
    if (busy || files.length === 0) {
      if (!files.length) setError('أضف صورة واحدة على الأقل للمتابعة.')
      return
    }
    setBusy(true)
    setError('')

    try {
      const imagePaths: string[] = []
      for (const file of files) {
        const uploadForm = new FormData()
        uploadForm.append('file', file)
        const response = await fetch('/api/uploads', { method: 'POST', body: uploadForm })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'تعذّر رفع الصور.')
        imagePaths.push(result.pathname)
      }

      const result = await submitListing({
        make,
        model,
        year: Number(year),
        condition,
        mileage: condition === 'new' ? 0 : Number(mileage),
        usageMonths: condition === 'new' ? 0 : Number(usageMonths),
        maintenanceVisited: maintenanceVisited === 'yes',
        maintenanceReason,
        repaired: repaired === 'yes',
        repairDetails,
        partsChanged: partsChanged === 'yes',
        changedParts,
        askingPrice: Number(askingPrice),
        negotiationMin: negotiationMin ? Number(negotiationMin) : null,
        negotiationMax: negotiationMax ? Number(negotiationMax) : null,
        city,
        description,
        sellerPhone,
        images: imagePaths,
      })
      if (!result.success) throw new Error(result.message)
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
          <h1>خطوة وتكمل الحكاية.</h1>
          <p>إعلانك الآن عند فريق مَسَار للمراجعة. بنخبرك أول ما يصير جاهزاً للعرض.</p>
          <div className="success-actions"><Link className="primary-button" href="/">العودة للسوق <ArrowLeft aria-hidden="true" /></Link><Link className="quiet-link" href="/admin">لوحة المراجعة</Link></div>
        </section>
      </main>
    )
  }

  return (
    <main className="wizard-page page-container">
      <div className="wizard-breadcrumb"><Link href="/">الرئيسية</Link><span>/</span><span>أضف إعلانك</span></div>
      <div className="wizard-heading"><div><span className="eyebrow eyebrow-green">إعلان جديد</span><h1>خلّ سيارتك تلقى طريقها.</h1><p>أضف التفاصيل بوضوح، وفريقنا يتولى مراجعة الإعلان قبل نشره.</p></div><div className="wizard-trust"><ShieldCheck aria-hidden="true" /><span>مراجعة مجانية<br /><strong>قبل النشر</strong></span></div></div>

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
          <div className="wizard-form-top"><span>الخطوة {String(step + 1).padStart(2, '0')} من 04</span><span>{steps[step].caption}</span></div>
          <div className="wizard-progress"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>

          <div id="listing-step-0" hidden={step !== 0}>
            <div className="form-section-heading"><span className="eyebrow eyebrow-green">أولاً، لنتعرف عليها</span><h2>ما هي سيارتك؟</h2><p>أخبرنا عن الأساسيات، ونكمل بعدها التفاصيل.</p></div>
            <div className="form-grid">
              <label className="form-field"><span>الشركة المصنّعة</span><input className="plain-input" value={make} onChange={(event) => setMake(event.target.value)} placeholder="مثال: تويوتا" required maxLength={50} /></label>
              <label className="form-field"><span>الموديل</span><input className="plain-input" value={model} onChange={(event) => setModel(event.target.value)} placeholder="مثال: كامري" required maxLength={60} /></label>
              <label className="form-field"><span>سنة الصنع</span><input className="plain-input" type="number" inputMode="numeric" min="1980" max={currentYear + 1} value={year} onChange={(event) => setYear(event.target.value)} required /></label>
              <label className="form-field"><span>حالة السيارة</span><select className="plain-input" value={condition} onChange={(event) => setCondition(event.target.value as 'new' | 'used')}><option value="used">مستعملة</option><option value="new">جديدة</option></select></label>
              {condition === 'used' && <>
                <label className="form-field"><span>الممشى (كم)</span><input className="plain-input" type="number" inputMode="numeric" min="0" max="2000000" value={mileage} onChange={(event) => setMileage(event.target.value)} placeholder="مثال: 32,000" required /></label>
                <label className="form-field"><span>مدة الاستخدام (بالأشهر)</span><input className="plain-input" type="number" inputMode="numeric" min="0" max="1200" value={usageMonths} onChange={(event) => setUsageMonths(event.target.value)} placeholder="مثال: 24" required /></label>
              </>}
            </div>
          </div>

          <div id="listing-step-1" hidden={step !== 1}>
            <div className="form-section-heading"><span className="eyebrow eyebrow-green">سجل واضح، ثقة أكبر</span><h2>كيف كانت رحلتها؟</h2><p>نحرص على إظهار معلومات تساعد المشتري على الاختيار.</p></div>
            <div className="form-stack">
              <label className="form-field"><span>هل زارت السيارة مراكز الصيانة؟</span><select className="plain-input" value={maintenanceVisited} onChange={(event) => setMaintenanceVisited(event.target.value)}><option value="yes">نعم</option><option value="no">لا</option></select></label>
              {maintenanceVisited === 'yes' && <label className="form-field"><span>ما سبب زيارات الصيانة؟</span><textarea className="plain-input plain-textarea" value={maintenanceReason} onChange={(event) => setMaintenanceReason(event.target.value)} placeholder="مثال: صيانة دورية كل 10,000 كم" maxLength={500} /></label>}
              <label className="form-field"><span>هل سبق إصلاح السيارة؟</span><select className="plain-input" value={repaired} onChange={(event) => setRepaired(event.target.value)}><option value="no">لا</option><option value="yes">نعم</option></select></label>
              {repaired === 'yes' && <label className="form-field"><span>تفاصيل الإصلاح</span><textarea className="plain-input plain-textarea" value={repairDetails} onChange={(event) => setRepairDetails(event.target.value)} placeholder="اذكر الإصلاحات وتوقيتها إن أمكن" maxLength={500} required /></label>}
              <label className="form-field"><span>هل تم تغيير أي قطع؟</span><select className="plain-input" value={partsChanged} onChange={(event) => setPartsChanged(event.target.value)}><option value="no">لا</option><option value="yes">نعم</option></select></label>
              {partsChanged === 'yes' && <label className="form-field"><span>ما القطع التي تم تغييرها؟</span><textarea className="plain-input plain-textarea" value={changedParts} onChange={(event) => setChangedParts(event.target.value)} placeholder="مثال: بطارية، إطارات..." maxLength={500} required /></label>}
            </div>
          </div>

          <div id="listing-step-2" hidden={step !== 2}>
            <div className="form-section-heading"><span className="eyebrow eyebrow-green">قيمة واضحة</span><h2>السعر والموقع.</h2><p>السعر الواضح يختصر الطريق بينك وبين المشتري المناسب.</p></div>
            <div className="form-grid">
              <label className="form-field"><span>السعر المطلوب (USD)</span><input className="plain-input" type="number" inputMode="numeric" min="1000" max="100000000" value={askingPrice} onChange={(event) => setAskingPrice(event.target.value)} placeholder="مثال: 24,500" required /></label>
              <label className="form-field"><span>المدينة أو المنطقة</span><input className="plain-input" list="syrian-cities" value={city} onChange={(event) => setCity(event.target.value)} placeholder="اختر مدينة أو اكتبها" required maxLength={60} /><datalist id="syrian-cities"><option value="دمشق" /><option value="حلب" /><option value="حمص" /><option value="اللاذقية" /><option value="طرطوس" /><option value="حماة" /></datalist></label>
              <label className="form-field"><span>أقل سعر تقبل به (USD) <small>اختياري</small></span><input className="plain-input" type="number" min="1000" value={negotiationMin} onChange={(event) => setNegotiationMin(event.target.value)} placeholder="$ USD" /></label>
              <label className="form-field"><span>أعلى سعر متوقع (USD) <small>اختياري</small></span><input className="plain-input" type="number" min="1000" value={negotiationMax} onChange={(event) => setNegotiationMax(event.target.value)} placeholder="$ USD" /></label>
              <label className="form-field form-field-wide"><span>رقم التواصل (مطلوب)</span><input className="plain-input" type="tel" inputMode="tel" value={sellerPhone} onChange={(event) => setSellerPhone(event.target.value)} placeholder="+963 9XX XXX XXX" pattern="\+?[0-9\s()-]{8,20}" required /></label>
              <label className="form-field form-field-wide"><span>نبذة عن السيارة <small>اختياري</small></span><textarea className="plain-input plain-textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="ما الذي يجعل سيارتك خياراً مميزاً؟" maxLength={1200} /></label>
            </div>
          </div>

          <div id="listing-step-3" hidden={step !== 3}>
            <div className="form-section-heading"><span className="eyebrow eyebrow-green">أخيراً، الصورة تكملها</span><h2>خلّها تنشاف.</h2><p>ارفع حتى 6 صور واضحة للسيارة. الصور بصيغة JPG أو PNG أو WebP.</p></div>
            <label className="upload-dropzone">
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFiles} aria-label="اختر صور السيارة" />
              <span className="upload-icon"><ImagePlus aria-hidden="true" /></span>
              <strong>اسحب الصور هنا أو اخترها من جهازك</strong>
              <small>حتى 6 صور · 4 ميغابايت للصورة كحد أقصى</small>
              <span className="upload-button"><Camera aria-hidden="true" /> اختيار الصور</span>
            </label>
            {previews.length > 0 && <div className="image-preview-grid">{previews.map((preview, index) => <div className="image-preview" key={preview}><Image src={preview} alt={`معاينة صورة السيارة ${index + 1}`} width={240} height={180} unoptimized /><button type="button" aria-label={`حذف الصورة ${index + 1}`} onClick={() => removeImage(index)}><X aria-hidden="true" /></button></div>)}</div>}
            <div className="upload-privacy"><ShieldCheck aria-hidden="true" /><span>صورك محفوظة بشكل خاص، وتظهر للمشترين فقط بعد الموافقة على الإعلان.</span></div>
          </div>

          {error && <p className="form-alert wizard-alert" role="alert">{error}</p>}
          <div className="wizard-actions">
            {step > 0 ? <button className="wizard-back" type="button" onClick={() => { setError(''); setStep((current) => current - 1) }}><ArrowRight aria-hidden="true" /> رجوع</button> : <span />}
            {step < steps.length - 1 ? <button className="primary-button wizard-next" type="button" onClick={goNext}>الخطوة التالية <ArrowLeft aria-hidden="true" /></button> : <button className="primary-button wizard-next" type="submit" disabled={busy || !files.length}>{busy ? 'جارٍ رفع الصور…' : 'إرسال للمراجعة'} {busy ? <span className="button-spinner" /> : <ArrowLeft aria-hidden="true" />}</button>}
          </div>
        </form>
      </div>
      <div className="wizard-bottom-note"><CheckCircle2 aria-hidden="true" /> إعلانك لن يظهر للناس إلا بعد مراجعة فريق مَسَار.</div>
    </main>
  )
}
