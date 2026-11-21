'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { Archive, ArrowUpLeft, BadgeCheck, Check, Clock3, MapPin, MessageCircle, ShieldCheck, Trash2, X } from 'lucide-react'
import { CarPhoto } from '@/components/marketplace/car-photo'
import { SupportInbox } from '@/components/marketplace/support-inbox'
import { carImageUrl } from '@/lib/car-image-url'
import type { AdminSupportTicket, CarListing } from '@/lib/db/schema'

const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
type AdminSection = 'pending' | 'published' | 'archived' | 'support'
type AdminDeleteTarget = { car: CarListing; archived: boolean }

function whatsappUrl(phone: string, make: string, model: string, year: number) {
  const digits = [...phone].filter((character) => character >= '0' && character <= '9').join('')
  const number = digits.startsWith('0') ? `963${digits.slice(1)}` : digits.length === 9 && digits.startsWith('9') ? `963${digits}` : digits
  const message = encodeURIComponent(`مرحباً، أنا من إدارة مَسَار وأرغب بالتحقق من إعلان ${make} ${model} ${year}.`)
  return `https://wa.me/${number}?text=${message}`
}

function AdminEmpty({ title, description }: { title: string; description: string }) {
  return <section className="admin-empty"><span><Check aria-hidden="true" /></span><h2>{title}</h2><p>{description}</p></section>
}

function AdminRecordCard({ car, archived, disabled, onArchive, onRepublish, onDelete }: { car: CarListing; archived: boolean; disabled: boolean; onArchive: (car: CarListing) => void; onRepublish: (car: CarListing) => void; onDelete: (car: CarListing, archived: boolean) => void }) {
  const photos = car.images.map((image) => image.startsWith('http') || image.startsWith('/')
    ? image
    : `/api/car-images?listing=${encodeURIComponent(car.id)}&path=${encodeURIComponent(image)}`)
  return (
    <article className="admin-card admin-record-card">
      <div className="admin-card-photo"><CarPhoto src={photos[0] || carImageUrl(car)} alt={`${car.make} ${car.model} ${car.year}`} width={520} height={360} /></div>
      <div className="admin-card-info">
        <div className="admin-card-title"><div><span className="listing-make">{car.make}</span><h2>{car.model} <small>{car.year}</small></h2></div><span className={`pending-pill ${archived ? 'is-archived' : 'is-published'}`}>{archived ? <Archive aria-hidden="true" /> : <BadgeCheck aria-hidden="true" />}{archived ? 'محذوف من المعلن / مباع' : 'منشور حالياً'}</span></div>
        <p className="admin-description">{car.description || 'لا توجد نبذة عن السيارة.'}</p>
        <div className="admin-facts"><span dir="ltr">${money.format(car.askingPrice)} USD</span><span>{money.format(car.mileage)} كم</span><span><MapPin aria-hidden="true" /> {car.city || 'سوريا'}</span><span><BadgeCheck aria-hidden="true" /> {car.sellerName || 'معلن مَسَار'}</span>{car.sellerPhone && <a href={`tel:${car.sellerPhone}`} dir="ltr">{car.sellerPhone}</a>}</div>
        <dl className="admin-record-details">
          <div><dt>الحالة</dt><dd>{car.condition === 'new' ? 'جديدة' : 'مستعملة'}</dd></div>
          <div><dt>مدة الاستخدام</dt><dd>{car.condition === 'new' ? 'جديدة' : `${car.usageMonths ?? 0} شهر`}</dd></div>
          <div><dt>زيارات الصيانة</dt><dd>{car.maintenanceVisited ? `نعم${car.maintenanceReason ? ` — ${car.maintenanceReason}` : ''}` : 'لا'}</dd></div>
          <div><dt>إصلاح أو حادث</dt><dd>{car.repaired ? `نعم${car.repairDetails ? ` — ${car.repairDetails}` : ''}` : 'لا'}</dd></div>
          <div><dt>تغيير قطع أساسية</dt><dd>{car.partsChanged ? `نعم${car.changedParts ? ` — ${car.changedParts}` : ''}` : 'لا'}</dd></div>
          <div><dt>حالة التوثيق</dt><dd>{car.verified ? 'موثق من مَسَار' : 'غير موثق'}</dd></div>
          <div><dt>معرّف الإعلان</dt><dd dir="ltr">{car.id}</dd></div>
        </dl>
        {photos.length > 1 && <div className="admin-record-gallery" aria-label="صور الإعلان">{photos.slice(1).map((src, index) => <CarPhoto key={`${car.id}-photo-${index}`} src={src} alt={`صورة ${index + 2} لإعلان ${car.make} ${car.model}`} width={180} height={120} />)}</div>}
        {car.verificationImage && <section className="admin-verification" aria-label="صورة التحقق الخاصة بالإدارة"><Image className="admin-verification-image" src={`/api/verification-image?listing=${encodeURIComponent(car.id)}`} alt={`صورة التحقق الخاصة بإعلان ${car.make} ${car.model}`} width={520} height={360} unoptimized /><div className="admin-verification-content"><strong>صورة التحقق وإثبات الجدية</strong><span>مرئية للإدارة فقط ولا تُنشر مع الإعلان.</span>{car.sellerPhone && <a className="admin-whatsapp" href={whatsappUrl(car.sellerPhone, car.make, car.model, car.year)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> مراسلة البائع عبر واتساب</a>}</div></section>}
        <div className="admin-record-actions">{archived ? <><button type="button" className="review-approve" disabled={disabled} onClick={() => onRepublish(car)}><BadgeCheck aria-hidden="true" />إعادة نشر الإعلان</button><button type="button" className="review-reject" disabled={disabled} onClick={() => onDelete(car, true)}><Trash2 aria-hidden="true" />حذف نهائي من الأرشيف</button></> : <><Link className="review-details" href={`/cars/${car.id}`} target="_blank" rel="noreferrer">تفاصيل الإعلان <ArrowUpLeft aria-hidden="true" /></Link><button type="button" className="admin-archive-action" disabled={disabled} onClick={() => onArchive(car)}><Archive aria-hidden="true" />نقل إلى الأرشيف</button></>}</div>
      </div>
    </article>
  )
}

export function AdminDashboard({ listings, publishedListings, archivedListings, supportTickets }: { listings: CarListing[]; publishedListings: CarListing[]; archivedListings: CarListing[]; supportTickets: AdminSupportTicket[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeId, setActiveId] = useState('')
  const [feedback, setFeedback] = useState('')
  const [verifiedSelections, setVerifiedSelections] = useState<Record<string, boolean>>({})
  const [rejectingId, setRejectingId] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [activeSection, setActiveSection] = useState<AdminSection>('pending')
  const [deleteTarget, setDeleteTarget] = useState<AdminDeleteTarget | null>(null)
  const [hiddenIds, setHiddenIds] = useState<string[]>([])
  const [isMutating, setIsMutating] = useState(false)
  const rejectDialogRef = useRef<HTMLDialogElement>(null)
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const visiblePending = listings.filter((car) => !hiddenIds.includes(car.id))
  const visiblePublished = publishedListings.filter((car) => !hiddenIds.includes(car.id))
  const visibleArchived = archivedListings.filter((car) => !hiddenIds.includes(car.id))

  useEffect(() => {
    const dialog = rejectDialogRef.current
    if (!dialog) return
    if (rejectingId && !dialog.open) dialog.showModal()
    if (!rejectingId && dialog.open) dialog.close()
  }, [rejectingId])

  useEffect(() => {
    const dialog = deleteDialogRef.current
    if (!dialog) return
    if (deleteTarget && !dialog.open) dialog.showModal()
    if (!deleteTarget && dialog.open) dialog.close()
  }, [deleteTarget])

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
        const message = result && typeof result === 'object' && 'message' in result && typeof result.message === 'string' ? result.message : 'تعذّر تحديث الإعلان.'
        setFeedback(message)
        if (response.ok) {
          if (status === 'rejected') { setRejectingId(''); setRejectionReason('') }
          router.refresh()
        } else if (status === 'rejected') setDialogError(message)
      } catch {
        const message = 'تعذّر الاتصال بالخادم. حاول مرة أخرى.'
        setFeedback(message)
        if (status === 'rejected') setDialogError(message)
      } finally {
        setActiveId('')
      }
    })
  }

  async function updateListingStatus(car: CarListing, action: 'archive' | 'republish') {
    if (isMutating) return
    setIsMutating(true)
    setFeedback('')
    try {
      const response = await fetch('/api/admin/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: car.id, action }),
      })
      const result: unknown = await response.json()
      const message = result && typeof result === 'object' && 'message' in result && typeof result.message === 'string' ? result.message : 'تعذّر تحديث الإعلان.'
      setFeedback(message)
      if (response.ok) {
        setActiveSection(action === 'archive' ? 'archived' : 'published')
        router.refresh()
      }
    } catch {
      setFeedback('تعذّر الاتصال بالخادم. حاول مرة أخرى.')
    } finally {
      setIsMutating(false)
    }
  }

  async function confirmPermanentDelete() {
    if (!deleteTarget || isMutating) return
    const { car } = deleteTarget
    setIsMutating(true)
    setHiddenIds((current) => [...current, car.id])
    setDeleteTarget(null)
    try {
      const response = await fetch('/api/admin/listings', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: car.id }) })
      const result: unknown = await response.json()
      const message = result && typeof result === 'object' && 'message' in result && typeof result.message === 'string' ? result.message : 'تعذّر حذف الإعلان.'
      setFeedback(message)
      if (response.ok) router.refresh()
      else setHiddenIds((current) => current.filter((id) => id !== car.id))
    } catch {
      setHiddenIds((current) => current.filter((id) => id !== car.id))
      setFeedback('تعذّر الاتصال بالخادم. حاول مرة أخرى.')
    } finally {
      setIsMutating(false)
    }
  }

  function handleRejectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!rejectingId) return
    if (!rejectionReason.trim()) { setDialogError('اكتب سبب الرفض قبل التأكيد.'); return }
    review(rejectingId, 'rejected', rejectionReason)
  }

  const selectedListings = activeSection === 'pending' ? visiblePending : activeSection === 'published' ? visiblePublished : activeSection === 'archived' ? visibleArchived : []

  return (
    <>
      <main className="admin-page page-container">
        <div className="admin-topline"><span className="eyebrow eyebrow-green"><ShieldCheck aria-hidden="true" /> مساحة فريق مَسَار</span><Link className="admin-back" href="/"><ArrowUpLeft aria-hidden="true" /> العودة للسوق</Link></div>
        <div className="admin-heading"><div><h1>إدارة مَسَار.</h1><p>راجع الإعلانات الواردة، وتابع طلبات الدعم وسجل الإعلانات.</p></div><div className="admin-count"><Clock3 aria-hidden="true" /><span><strong>{visiblePending.length}</strong><small>بانتظار المراجعة</small></span></div></div>
        <nav className="admin-tabs" aria-label="أقسام الإدارة">
          <button type="button" aria-pressed={activeSection === 'pending'} className={activeSection === 'pending' ? 'admin-tab is-active' : 'admin-tab'} onClick={() => setActiveSection('pending')}><Clock3 aria-hidden="true" />طلبات المراجعة<span>{visiblePending.length}</span></button>
          <button type="button" aria-pressed={activeSection === 'published'} className={activeSection === 'published' ? 'admin-tab is-active' : 'admin-tab'} onClick={() => setActiveSection('published')}><BadgeCheck aria-hidden="true" />الإعلانات المنشورة<span>{visiblePublished.length}</span></button>
          <button type="button" aria-pressed={activeSection === 'archived'} className={activeSection === 'archived' ? 'admin-tab is-active' : 'admin-tab'} onClick={() => setActiveSection('archived')}><Archive aria-hidden="true" />أرشيف الإعلانات المحذوفة / المباعة<span>{visibleArchived.length}</span></button>
          <button type="button" aria-pressed={activeSection === 'support'} className={activeSection === 'support' ? 'admin-tab is-active' : 'admin-tab'} onClick={() => setActiveSection('support')}><MessageCircle aria-hidden="true" />طلبات الدعم<span>{supportTickets.length}</span></button>
        </nav>
        {feedback && <p className="form-success admin-feedback" role="status">{feedback}</p>}
        {activeSection === 'support' ? <SupportInbox tickets={supportTickets} /> : selectedListings.length ? <div className="admin-list">
          {activeSection === 'pending' ? visiblePending.map((car) => <article className="admin-card" key={car.id}>
            <div className="admin-card-photo"><CarPhoto src={carImageUrl(car)} alt={`${car.make} ${car.model}`} width={520} height={360} /></div>
            <div className="admin-card-info">
              <div className="admin-card-title"><div><span className="listing-make">{car.make}</span><h2>{car.model} <small>{car.year}</small></h2></div><span className="pending-pill"><Clock3 aria-hidden="true" /> قيد المراجعة</span></div>
              <p className="admin-description">{car.description || 'لا توجد نبذة عن السيارة.'}</p>
              <div className="admin-facts"><span dir="ltr">${money.format(car.askingPrice)} USD</span><span>{money.format(car.mileage)} كم</span><span><MapPin aria-hidden="true" /> {car.city}</span><span><BadgeCheck aria-hidden="true" /> {car.sellerName}</span></div>
              <section className="admin-verification" aria-label="صورة التحقق الخاصة بالإدارة">
                {car.verificationImage ? <Image className="admin-verification-image" src={`/api/verification-image?listing=${encodeURIComponent(car.id)}`} alt={`صورة التحقق الخاصة بإعلان ${car.make} ${car.model}`} width={520} height={360} unoptimized /> : <div className="admin-verification-missing">لم تُرفق صورة تحقق لهذا الإعلان.</div>}
                <div className="admin-verification-content"><strong>صورة التحقق وإثبات الجدية</strong><span>مرئية للإدارة فقط ولا تُنشر مع الإعلان.</span>{car.sellerPhone && <a className="admin-whatsapp" href={whatsappUrl(car.sellerPhone, car.make, car.model, car.year)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> مراسلة البائع عبر واتساب للتحقق</a>}</div>
              </section>
              <div className="admin-review-actions"><Link className="review-details" href={`/cars/${car.id}`} target="_blank" rel="noreferrer">تفاصيل الإعلان <ArrowUpLeft aria-hidden="true" /></Link><label className="admin-verified-toggle"><input type="checkbox" checked={verifiedSelections[car.id] ?? false} disabled={isPending || isMutating} onChange={(event) => setVerifiedSelections((current) => ({ ...current, [car.id]: event.target.checked }))} /><span>منح شارة إعلان موثق من إدارة مَسَار</span></label><button type="button" className="review-reject" disabled={isPending || isMutating} onClick={() => openRejectDialog(car.id)}><X aria-hidden="true" /> رفض مع توضيح السبب</button><button type="button" className="review-approve" disabled={isPending || isMutating || !car.verificationImage} title={!car.verificationImage ? 'لا يمكن الموافقة دون صورة تحقق' : undefined} onClick={() => review(car.id, 'approved')}><Check aria-hidden="true" />{activeId === car.id ? 'جارٍ التحديث…' : 'موافقة ونشر'}</button></div>
            </div>
          </article>) : selectedListings.map((car) => <AdminRecordCard key={car.id} car={car} archived={activeSection === 'archived'} disabled={isMutating} onArchive={(item) => updateListingStatus(item, 'archive')} onRepublish={(item) => updateListingStatus(item, 'republish')} onDelete={(item, archived) => setDeleteTarget({ car: item, archived })} />)}
        </div> : <AdminEmpty title={activeSection === 'pending' ? 'لا توجد طلبات معلقة' : activeSection === 'published' ? 'لا توجد إعلانات منشورة' : 'الأرشيف فارغ حالياً'} description={activeSection === 'pending' ? 'لا توجد إعلانات تنتظر المراجعة حالياً.' : activeSection === 'published' ? 'ستظهر هنا السيارات المنشورة في السوق.' : 'الإعلانات التي يزيلها أصحابها من العرض ستُحفظ هنا للإدارة.'} />}
      </main>
      <dialog ref={deleteDialogRef} className="listing-action-dialog" aria-labelledby="admin-delete-title" onCancel={() => setDeleteTarget(null)} onClose={() => { if (deleteTarget) setDeleteTarget(null) }}>
        {deleteTarget && <div className="listing-action-form">
          <span className="listing-action-icon"><Trash2 aria-hidden="true" /></span><span className="listing-action-eyebrow">إجراء إداري نهائي</span>
          <h2 id="admin-delete-title">{deleteTarget.archived ? 'حذف نهائي من الأرشيف؟' : 'حذف الإعلان نهائياً؟'}</h2>
          <p>سيُحذف الإعلان من قاعدة البيانات وصوره من مخزن الملفات. لا يمكن التراجع عن هذا الإجراء.</p>
          <div className="listing-action-summary"><strong>{deleteTarget.car.make} {deleteTarget.car.model} {deleteTarget.car.year}</strong><span dir="ltr">${money.format(deleteTarget.car.askingPrice)} USD</span></div>
          <div className="listing-action-buttons"><button type="button" className="listing-action-cancel" disabled={isMutating} onClick={() => setDeleteTarget(null)}>إلغاء</button><button type="button" className="listing-action-confirm" disabled={isMutating} onClick={confirmPermanentDelete}>{isMutating ? 'جارٍ الحذف…' : 'تأكيد الحذف النهائي'}</button></div>
        </div>}
      </dialog>
      <dialog ref={rejectDialogRef} className="admin-reject-dialog" aria-labelledby="reject-dialog-title" onCancel={() => setRejectingId('')} onClose={() => { if (rejectingId) setRejectingId('') }}>
        <form className="admin-reject-form" onSubmit={handleRejectSubmit}>
          <span className="admin-reject-eyebrow">إجراء إداري</span><h2 id="reject-dialog-title">رفض الإعلان مع توضيح السبب</h2><p>سيظهر هذا السبب لصاحب الإعلان في صفحة «إعلاناتي» كما كُتب.</p>
          <label htmlFor="listing-rejection-reason">سبب الرفض</label><textarea id="listing-rejection-reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={2000} rows={5} required disabled={isPending} aria-describedby={dialogError ? 'rejection-dialog-limit rejection-dialog-error' : 'rejection-dialog-limit'} placeholder="مثال: صورة التحقق غير واضحة أو السعر يحتاج إلى مراجعة." />
          <small id="rejection-dialog-limit">حتى 2000 حرف</small>{dialogError && <p className="admin-reject-error" id="rejection-dialog-error" role="alert">{dialogError}</p>}
          <div className="admin-reject-dialog-actions"><button type="button" className="admin-reject-cancel" disabled={isPending} onClick={() => setRejectingId('')}>إلغاء</button><button type="submit" className="admin-reject-confirm" disabled={isPending}>{isPending ? 'جارٍ حفظ الملاحظة…' : 'تأكيد الرفض وإرسال الملاحظة'}</button></div>
        </form>
      </dialog>
    </>
  )
}
