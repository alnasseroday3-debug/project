'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Archive, ArrowLeft, BadgeCheck, Clock3, FileText, RefreshCw, Trash2, XCircle } from 'lucide-react'
import { removeOwnedListing, renewOwnedListing } from '@/app/actions/listings'
import { CarPhoto } from '@/components/marketplace/car-photo'
import { carImageUrl } from '@/lib/car-image-url'
import { listingAgeLabel } from '@/lib/listing-age'
import type { OwnerCarListing } from '@/lib/db/schema'

const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const daysUntilExpiry = (expiresAt: Date | null) => expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null

const listingStatus = {
  pending: { label: 'قيد المراجعة', className: 'my-listing-status is-pending', icon: Clock3 },
  approved: { label: 'مقبول ومنشور', className: 'my-listing-status is-approved', icon: BadgeCheck },
  rejected: { label: 'مرفوض', className: 'my-listing-status is-rejected', icon: XCircle },
  archived: { label: 'انتهى العرض', className: 'my-listing-status is-expired', icon: Archive },
} as const

const removeLabels = {
  approved: 'تم البيع / إزالة من العرض',
  pending: 'إلغاء وحذف الطلب',
  rejected: 'حذف نهائي',
  archived: 'حذف من قائمتي',
} as const

export function MyListings({ listings }: { listings: OwnerCarListing[] }) {
  const router = useRouter()
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const renewalDialogRef = useRef<HTMLDialogElement>(null)
  const [confirmingListing, setConfirmingListing] = useState<OwnerCarListing | null>(null)
  const [renewingListing, setRenewingListing] = useState<OwnerCarListing | null>(null)
  const [hiddenIds, setHiddenIds] = useState<string[]>([])
  const [feedback, setFeedback] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRenewing, setIsRenewing] = useState(false)

  useEffect(() => {
    const dialog = deleteDialogRef.current
    if (!dialog) return
    if (confirmingListing && !dialog.open) dialog.showModal()
    if (!confirmingListing && dialog.open) dialog.close()
  }, [confirmingListing])

  useEffect(() => {
    const dialog = renewalDialogRef.current
    if (!dialog) return
    if (renewingListing && !dialog.open) dialog.showModal()
    if (!renewingListing && dialog.open) dialog.close()
  }, [renewingListing])

  async function removeListing(listing: OwnerCarListing) {
    if (isDeleting) return
    setIsDeleting(true)
    setFeedback('')
    setHiddenIds((current) => current.includes(listing.id) ? current : [...current, listing.id])
    setConfirmingListing(null)
    setRenewingListing(null)
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
  }

  async function confirmRemoval() {
    if (confirmingListing) await removeListing(confirmingListing)
  }

  async function confirmRenewal() {
    if (!renewingListing || isRenewing) return
    setIsRenewing(true)
    setFeedback('')
    try {
      const result = await renewOwnedListing(renewingListing.id)
      setFeedback(result.message)
      if (result.success) {
        setRenewingListing(null)
        router.refresh()
      }
    } catch {
      setFeedback('تعذّر الاتصال بالخادم. حاول مرة أخرى.')
    } finally {
      setIsRenewing(false)
    }
  }

  function handleSoldSelection() {
    if (renewingListing) void removeListing(renewingListing)
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
          const isAdminArchived = car.status === 'archived' && car.archivedByAdmin
          const isExpiryArchived = car.status === 'archived' && car.archivedByExpiry
          const status = listingStatus[car.status as keyof typeof listingStatus] ?? listingStatus.pending
          const StatusIcon = isAdminArchived ? Archive : status.icon
          const daysRemaining = daysUntilExpiry(car.expiresAt)
          const canRenew = (car.status === 'approved' && daysRemaining !== null && daysRemaining <= 5) || isExpiryArchived
          return (
            <article className="my-listing-card" key={car.id}>
              <div className="my-listing-photo"><CarPhoto src={carImageUrl(car)} alt={`${car.make} ${car.model} ${car.year}`} width={720} height={480} /><span className="listing-age-badge">{listingAgeLabel(car.publishedAt ?? car.createdAt)}</span></div>
              <div className="my-listing-content">
                <div className="my-listing-top"><span className={`${status.className}${isAdminArchived ? ' is-admin-archived' : ''}`}><StatusIcon aria-hidden="true" />{isAdminArchived ? 'تمت أرشفة الإعلان وإيقافه من قِبل الإدارة' : status.label}</span><span className="my-listing-year">{car.year}</span></div>
                <p className="listing-make">{car.make}</p>
                <h2>{car.model}</h2>
                <p className="my-listing-price" dir="ltr">${money.format(car.askingPrice)} USD</p>
                {isAdminArchived ? <>
                  <section className="my-listing-admin-archive" aria-label="معلومات أرشفة الإدارة">
                    <p>تمت أرشفة هذا الإعلان وإيقافه من قِبل الإدارة — راجع الإدارة إذا أردت الاستفسار.</p>
                  </section>
                  <button type="button" className="my-listing-delete" disabled={isDeleting} onClick={() => setConfirmingListing(car)}><Trash2 aria-hidden="true" />حذف من قائمتي</button>
                </> : isExpiryArchived ? <>
                  <p className="my-listing-note">انتهت مدة العرض، ويمكنك تأكيد توفر السيارة لتجديد الإعلان.</p>
                  <button type="button" className="my-listing-renew" onClick={() => setRenewingListing(car)}><RefreshCw aria-hidden="true" />تجديد الإعلان</button>
                </> : car.status === 'approved' ? <>
                  <Link className="my-listing-link" href={`/cars/${car.id}`}>مشاهدة الإعلان <ArrowLeft aria-hidden="true" /></Link>
                  {daysRemaining !== null && <span className={`my-listing-expiry${daysRemaining <= 5 ? ' is-near-expiry' : ''}`}><Clock3 aria-hidden="true" />{daysRemaining > 0 ? `متبقي ${daysRemaining} يوماً على انتهاء العرض` : 'انتهت مدة العرض'}</span>}
                  {canRenew && <button type="button" className="my-listing-renew" onClick={() => setRenewingListing(car)}><RefreshCw aria-hidden="true" />تجديد الإعلان</button>}
                  <button type="button" className="my-listing-delete" disabled={isDeleting} onClick={() => setConfirmingListing(car)}><Trash2 aria-hidden="true" />{removeLabels.approved}</button>
                </> : car.status === 'rejected' ? <>
                  <section className="my-listing-rejection" aria-label="سبب الرفض من الإدارة">
                    <strong>سبب الرفض من الإدارة</strong>
                    <p>{car.rejectionReason || 'لم يوضح فريق الإدارة سبب الرفض. يمكنك تعديل الإعلان وإعادة إرساله للمراجعة.'}</p>
                  </section>
                  <Link className="my-listing-edit" href={`/my-listings/${encodeURIComponent(car.id)}/edit`}>تعديل الإعلان وإعادة الإرسال <ArrowLeft aria-hidden="true" /></Link>
                  <button type="button" className="my-listing-delete" disabled={isDeleting} onClick={() => setConfirmingListing(car)}><Trash2 aria-hidden="true" />{removeLabels.rejected}</button>
                </> : <>
                  <span className="my-listing-note">سيظهر إعلانك في السوق بعد اكتمال المراجعة.</span>
                  <button type="button" className="my-listing-delete" disabled={isDeleting} onClick={() => setConfirmingListing(car)}><Trash2 aria-hidden="true" />{removeLabels.pending}</button>
                </>}
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
          <p>{confirmingListing?.archivedByAdmin
            ? 'سيُخفى الإعلان من قائمتك فقط، وسيبقى محفوظاً ضمن أرشيف الإدارة.'
            : confirmingListing?.status === 'approved'
              ? 'سيختفي الإعلان فوراً عن الزوار، وسيُحفظ في أرشيف الإدارة. لن تتمكن من إعادته إلى العرض.'
              : confirmingListing?.status === 'archived'
                ? 'سيُخفى الإعلان من قائمتك فقط، وسيظل محفوظاً في أرشيف الإدارة.'
                : confirmingListing?.status === 'pending'
                  ? 'سيُلغى طلب المراجعة ويُحذف الإعلان وصوره نهائياً من حسابك.'
                  : 'سيُحذف الإعلان المرفوض وصوره نهائياً، ولا يمكن التراجع عن هذا الإجراء.'}</p>
          <div className="listing-delete-actions">
            <button type="button" className="listing-delete-cancel" disabled={isDeleting} onClick={() => setConfirmingListing(null)}>تراجع</button>
            <button type="button" className="listing-delete-confirm" disabled={isDeleting} onClick={confirmRemoval}>{isDeleting ? 'جارٍ التنفيذ…' : 'تأكيد'}</button>
          </div>
        </div>
      </dialog>
      <dialog
        ref={renewalDialogRef}
        className="listing-renewal-dialog"
        aria-labelledby="listing-renewal-title"
        onCancel={() => setRenewingListing(null)}
        onClose={() => { if (renewingListing && !isRenewing) setRenewingListing(null) }}
      >
        <div className="listing-renewal-content">
          <span className="listing-renewal-icon"><RefreshCw aria-hidden="true" /></span>
          <span className="listing-delete-eyebrow">تجديد العرض</span>
          <h2 id="listing-renewal-title">هل السيارة لا تزال متوفرة لديك ولم تُبع بعد؟</h2>
          <p>اختر الحالة المناسبة؛ لا يتم تجديد الإعلان إلا بعد تأكيدك.</p>
          <div className="listing-renewal-actions">
            <button type="button" className="listing-renewal-confirm" disabled={isRenewing || isDeleting} onClick={confirmRenewal}>
              <BadgeCheck aria-hidden="true" />{isRenewing ? 'جارٍ تجديد العرض…' : 'نعم، السيارة لا تزال متوفرة — جدّد العرض 30 يوماً'}
            </button>
            <button type="button" className="listing-renewal-sold" disabled={isRenewing || isDeleting} onClick={handleSoldSelection}>
              <Trash2 aria-hidden="true" />لا، تم بيع السيارة — إزالة الإعلان من العرض
            </button>
            <button type="button" className="listing-renewal-cancel" disabled={isRenewing || isDeleting} onClick={() => setRenewingListing(null)}>إلغاء</button>
          </div>
        </div>
      </dialog>
    </>
  )
}
