'use client'

import Image from 'next/image'
import { CarPhoto } from '@/components/marketplace/car-photo'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { ArrowUpLeft, BadgeCheck, Check, Clock3, MapPin, MessageCircle, ShieldCheck, X } from 'lucide-react'
import { carImageUrl } from '@/lib/car-image-url'
import type { CarListing } from '@/lib/db/schema'

const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

function whatsappUrl(phone: string, make: string, model: string, year: number) {
  const digits = [...phone].filter((character) => character >= '0' && character <= '9').join('')
  const number = digits.startsWith('0') ? `963${digits.slice(1)}` : digits.length === 9 && digits.startsWith('9') ? `963${digits}` : digits
  const message = encodeURIComponent(`مرحباً، أنا من إدارة مَسَار وأرغب بالتحقق من إعلان ${make} ${model} ${year}.`)
  return `https://wa.me/${number}?text=${message}`
}

export function AdminDashboard({ listings }: { listings: CarListing[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeId, setActiveId] = useState('')
  const [feedback, setFeedback] = useState('')
  const [verifiedSelections, setVerifiedSelections] = useState<Record<string, boolean>>({})
  const [rejectingId, setRejectingId] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [dialogError, setDialogError] = useState('')
  const rejectDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = rejectDialogRef.current
    if (!dialog) return
    if (rejectingId && !dialog.open) dialog.showModal()
    if (!rejectingId && dialog.open) dialog.close()
  }, [rejectingId])

  function openRejectDialog(id: string) {
    setRejectingId(id)
    setRejectionReason('')
    setDialogError('')
  }

  function review(id: string, status: 'approved' | 'rejected', reason?: string) {
    setActiveId(id)
    setFeedback('')
    setDialogError('')
    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/listings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status, verified: status === 'approved' && (verifiedSelections[id] ?? false), rejectionReason: reason }),
        })
        const result: unknown = await response.json()
        const message = result && typeof result === 'object' && 'message' in result && typeof result.message === 'string'
          ? result.message
          : 'تعذّر تحديث الإعلان.'
        setFeedback(message)
        if (response.ok) {
          if (status === 'rejected') {
            setRejectingId('')
            setRejectionReason('')
          }
          router.refresh()
        } else if (status === 'rejected') {
          setDialogError(message)
        }
      } catch {
        const message = 'تعذّر الاتصال بالخادم. حاول مرة أخرى.'
        setFeedback(message)
        if (status === 'rejected') setDialogError(message)
      } finally {
        setActiveId('')
      }
    })
  }

  function handleRejectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!rejectingId) return
    if (!rejectionReason.trim()) {
      setDialogError('اكتب سبب الرفض قبل التأكيد.')
      return
    }
    review(rejectingId, 'rejected', rejectionReason)
  }

  return (
    <>
      <main className="admin-page page-container">
      <div className="admin-topline"><span className="eyebrow eyebrow-green"><ShieldCheck aria-hidden="true" /> مساحة فريق مَسَار</span><Link className="admin-back" href="/"><ArrowUpLeft aria-hidden="true" /> العودة للسوق</Link></div>
      <div className="admin-heading"><div><h1>مراجعة الإعلانات.</h1><p>تأكد من اكتمال التفاصيل قبل نشر السيارة للمشترين.</p></div><div className="admin-count"><Clock3 aria-hidden="true" /><span><strong>{listings.length}</strong><small>بانتظار المراجعة</small></span></div></div>
      {feedback && <p className="form-success admin-feedback" role="status">{feedback}</p>}
      {listings.length ? <div className="admin-list">{listings.map((car) => <article className="admin-card" key={car.id}>
        <div className="admin-card-photo"><CarPhoto src={carImageUrl(car)} alt={`${car.make} ${car.model}`} width={520} height={360} /></div>
        <div className="admin-card-info">
          <div className="admin-card-title"><div><span className="listing-make">{car.make}</span><h2>{car.model} <small>{car.year}</small></h2></div><span className="pending-pill"><Clock3 aria-hidden="true" /> قيد المراجعة</span></div>
          <p className="admin-description">{car.description || 'لا توجد نبذة عن السيارة.'}</p>
          <div className="admin-facts"><span dir="ltr">${money.format(car.askingPrice)} USD</span><span>{money.format(car.mileage)} كم</span><span><MapPin aria-hidden="true" /> {car.city}</span><span><BadgeCheck aria-hidden="true" /> {car.sellerName}</span></div>
          <section className="admin-verification" aria-label="صورة التحقق الخاصة بالإدارة">
            {car.verificationImage ? <Image className="admin-verification-image" src={`/api/verification-image?listing=${encodeURIComponent(car.id)}`} alt={`صورة التحقق الخاصة بإعلان ${car.make} ${car.model}`} width={520} height={360} unoptimized /> : <div className="admin-verification-missing">لم تُرفق صورة تحقق لهذا الإعلان.</div>}
            <div className="admin-verification-content"><strong>صورة التحقق وإثبات الجدية</strong><span>مرئية للإدارة فقط ولا تُنشر مع الإعلان.</span>{car.sellerPhone && <a className="admin-whatsapp" href={whatsappUrl(car.sellerPhone, car.make, car.model, car.year)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> مراسلة البائع عبر واتساب للتحقق</a>}</div>
          </section>
          <div className="admin-review-actions"><Link className="review-details" href={`/cars/${car.id}`} target="_blank" rel="noreferrer">تفاصيل الإعلان <ArrowUpLeft aria-hidden="true" /></Link><label className="admin-verified-toggle"><input type="checkbox" checked={verifiedSelections[car.id] ?? false} disabled={isPending} onChange={(event) => setVerifiedSelections((current) => ({ ...current, [car.id]: event.target.checked }))} /><span>منح شارة إعلان موثق من إدارة مَسَار</span></label><button type="button" className="review-reject" disabled={isPending} onClick={() => openRejectDialog(car.id)}><X aria-hidden="true" /> رفض مع توضيح السبب</button><button type="button" className="review-approve" disabled={isPending || !car.verificationImage} title={!car.verificationImage ? 'لا يمكن الموافقة دون صورة تحقق' : undefined} onClick={() => review(car.id, 'approved')}><Check aria-hidden="true" /> {activeId === car.id ? 'جارٍ التحديث…' : 'موافقة ونشر'}</button></div>
        </div>
      </article>)}</div> : <section className="admin-empty"><span><Check aria-hidden="true" /></span><h2>أنت على اطلاع.</h2><p>لا توجد إعلانات تنتظر المراجعة حالياً.</p><Link className="primary-button" href="/">تصفح السوق <ArrowUpLeft aria-hidden="true" /></Link></section>}
    </main>
    <dialog
      ref={rejectDialogRef}
      className="admin-reject-dialog"
      aria-labelledby="reject-dialog-title"
      onCancel={() => setRejectingId('')}
      onClose={() => { if (rejectingId) setRejectingId('') }}
    >
      <form className="admin-reject-form" onSubmit={handleRejectSubmit}>
        <span className="admin-reject-eyebrow">إجراء إداري</span>
        <h2 id="reject-dialog-title">رفض الإعلان مع توضيح السبب</h2>
        <p>سيظهر هذا السبب لصاحب الإعلان في صفحة «إعلاناتي» كما كُتب.</p>
        <label htmlFor="listing-rejection-reason">سبب الرفض</label>
        <textarea
          id="listing-rejection-reason"
          value={rejectionReason}
          onChange={(event) => setRejectionReason(event.target.value)}
          maxLength={2000}
          rows={5}
          required
          disabled={isPending}
          aria-describedby={dialogError ? 'rejection-dialog-limit rejection-dialog-error' : 'rejection-dialog-limit'}
          placeholder="مثال: صورة التحقق غير واضحة أو السعر يحتاج إلى مراجعة."
        />
        <small id="rejection-dialog-limit">حتى 2000 حرف</small>
        {dialogError && <p className="admin-reject-error" id="rejection-dialog-error" role="alert">{dialogError}</p>}
        <div className="admin-reject-dialog-actions">
          <button type="button" className="admin-reject-cancel" disabled={isPending} onClick={() => setRejectingId('')}>إلغاء</button>
          <button type="submit" className="admin-reject-confirm" disabled={isPending}>
            {isPending ? 'جارٍ حفظ الملاحظة…' : 'تأكيد الرفض وإرسال الملاحظة'}
          </button>
        </div>
      </form>
    </dialog>
    </>
  )
}
