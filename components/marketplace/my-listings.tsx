'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, BadgeCheck, Clock3, FileText, Trash2, XCircle } from 'lucide-react'
import { removeOwnedListing } from '@/app/actions/listings'
import { CarPhoto } from '@/components/marketplace/car-photo'
import { carImageUrl } from '@/lib/car-image-url'
import type { OwnerCarListing } from '@/lib/db/schema'

const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

const listingStatus = {
  pending: { label: 'قيد المراجعة', className: 'my-listing-status is-pending', icon: Clock3 },
  approved: { label: 'مقبول ومنشور', className: 'my-listing-status is-approved', icon: BadgeCheck },
  rejected: { label: 'مرفوض', className: 'my-listing-status is-rejected', icon: XCircle },
} as const

const removeLabels = {
  approved: 'تم البيع / إزالة من العرض',
  pending: 'إلغاء وحذف الطلب',
  rejected: 'حذف نهائي',
} as const

export function MyListings({ listings }: { listings: OwnerCarListing[] }) {
  const router = useRouter()
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const [confirmingListing, setConfirmingListing] = useState<OwnerCarListing | null>(null)
  const [hiddenIds, setHiddenIds] = useState<string[]>([])
  const [feedback, setFeedback] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const dialog = deleteDialogRef.current
    if (!dialog) return
    if (confirmingListing && !dialog.open) dialog.showModal()
    if (!confirmingListing && dialog.open) dialog.close()
  }, [confirmingListing])

  async function confirmRemoval() {
    if (!confirmingListing || isDeleting) return
    const listing = confirmingListing
    setIsDeleting(true)
    setFeedback('')
    setHiddenIds((current) => [...current, listing.id])
    setConfirmingListing(null)
    try {
    try {
      const result = await removeOwnedListing(listing.id)
      if (!result.success) setHiddenIds((current) => current.filter((id) => id !== listing.id))
      setFeedback(result.message)
      if (result.success) router.refresh()
    } catch {
      setHiddenIds((current) => current.filter((id) => id !== listing.id))
      setFeedback('تعذّر الاتصال بالخادم. حاول مرة أخرى.')
    } finally {
      setIsDeleting(false)
    }

    } catch {
      setHiddenIds((current) => current.filter((id) => id !== listing.id))
      setFeedback('تعذّر الاتصال بالخادم. حاول مرة أخرى.')
    } finally {
      setIsDeleting(false)
    }
  }

  const visibleListings = listings.filter((listing) => !hiddenIds.includes(listing.id))

  return (
    <>
      <main className="my-listings-page page-container">
        <div className="my-listings-heading">
          <div><span className="eyebrow eyebrow-green">مساحتك في مَسَار</span><h1>إعلاناتي</h1><p>تابع حالة سياراتك المنشورة أو التي ما زالت قيد المراجعة.</p></div>
          <Link className="primary-button" href="/sell">إضافة سيارة <ArrowLeft aria-hidden="true" /></Link>
        </div>
        {feedback && <p className="my-listings-feedback" role="status">{feedback}</p>}
        {visibleListings.length ? <div className="my-listings-grid">{visibleListings.map((car) => {
          const status = listingStatus[car.status as keyof typeof listingStatus] ?? listingStatus.pending
          const StatusIcon = status.icon
          return (
            <article className="my-listing-card" key={car.id}>
              <div className="my-listing-photo"><CarPhoto src={carImageUrl(car)} alt={`${car.make} ${car.model} ${car.year}`} width={720} height={480} /></div>
              <div className="my-listing-content">
                <div className="my-listing-top"><span className={status.className}><StatusIcon aria-hidden="true" />{status.label}</span><span className="my-listing-year">{car.year}</span></div>
                <p className="listing-make">{car.make}</p>
                <h2>{car.model}</h2>
                <p className="my-listing-price" dir="ltr">${money.format(car.askingPrice)} USD</p>
                {car.status === 'approved' ? <Link className="my-listing-link" href={`/cars/${car.id}`}>مشاهدة الإعلان <ArrowLeft aria-hidden="true" /></Link> : car.status === 'rejected' ? <>
                  <section className="my-listing-rejection" aria-label="سبب الرفض من الإدارة">
                    <strong>سبب الرفض من الإدارة</strong>
                    <p>{car.rejectionReason || 'لم يوضح فريق الإدارة سبب الرفض. يمكنك تعديل الإعلان وإعادة إرساله للمراجعة.'}</p>
                  </section>
                  <Link className="my-listing-edit" href={`/my-listings/${encodeURIComponent(car.id)}/edit`}>تعديل الإعلان وإعادة الإرسال <ArrowLeft aria-hidden="true" /></Link>
                </> : <span className="my-listing-note">سيظهر إعلانك في السوق بعد اكتمال المراجعة.</span>}
                <button type="button" className="my-listing-delete" disabled={isDeleting} onClick={() => setConfirmingListing(car)}>
                  <Trash2 aria-hidden="true" />{removeLabels[car.status as keyof typeof removeLabels] ?? removeLabels.pending}
                </button>
              </div>
            </article>
          )
        })}</div> : <section className="my-listings-empty"><span><FileText aria-hidden="true" /></span><h2>لا توجد إعلانات بعد</h2><p>أضف سيارتك وراجع حالتها من هذه الصفحة في أي وقت.</p><Link className="primary-button" href="/sell">أضف أول إعلان <ArrowLeft aria-hidden="true" /></Link></section>}
      </main>
      <dialog
        ref={deleteDialogRef}
        className="listing-delete-dialog"
        aria-labelledby="listing-delete-title"
        onCancel={() => setConfirmingListing(null)}
        onClose={() => { if (confirmingListing) setConfirmingListing(null) }}
      >
        <div className="listing-delete-content">
          <span className="listing-delete-icon"><Trash2 aria-hidden="true" /></span>
          <span className="listing-delete-eyebrow">تأكيد الإجراء</span>
          <h2 id="listing-delete-title">{confirmingListing ? removeLabels[confirmingListing.status as keyof typeof removeLabels] : 'إزالة الإعلان'}</h2>
          <p>{confirmingListing?.status === 'approved'
            ? 'سيختفي الإعلان فوراً عن الزوار، وسيُحفظ في أرشيف الإدارة. لن تتمكن من إعادته إلى العرض.'
            : confirmingListing?.status === 'pending'
              ? 'سيُلغى طلب المراجعة ويُحذف الإعلان وصوره نهائياً من حسابك.'
              : 'سيُحذف الإعلان المرفوض وصوره نهائياً، ولا يمكن التراجع عن هذا الإجراء.'}</p>
          <div className="listing-delete-actions">
            <button type="button" className="listing-delete-cancel" disabled={isDeleting} onClick={() => setConfirmingListing(null)}>تراجع</button>
            <button type="button" className="listing-delete-confirm" disabled={isDeleting} onClick={confirmRemoval}>{isDeleting ? 'جارٍ التنفيذ…' : 'تأكيد'}</button>
          </div>
        </div>
      </dialog>
    </>
  )
}
