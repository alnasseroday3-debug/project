'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, X } from 'lucide-react'
import { removeOwnedListing } from '@/app/actions/listings'

export function ListingDetailActions({ listingId, isAdmin }: { listingId: string; isAdmin: boolean }) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  async function confirmDeletion() {
    if (isDeleting) return
    setIsDeleting(true)
    setError('')

    try {
      if (isAdmin) {
        const response = await fetch('/api/admin/listings', {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: listingId }),
        })
        const result = await response.json().catch(() => ({})) as { success?: boolean; message?: string }
        if (!response.ok || !result.success) throw new Error(result.message || 'تعذّر حذف الإعلان الآن.')
      } else {
        const result = await removeOwnedListing(listingId)
        if (!result.success) throw new Error(result.message)
      }

      dialogRef.current?.close()
      router.replace('/')
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذّر حذف الإعلان الآن.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <button className="detail-delete-button" type="button" onClick={() => { setError(''); dialogRef.current?.showModal() }}>
        <Trash2 aria-hidden="true" /> حذف الإعلان
      </button>
      <dialog ref={dialogRef} className="listing-delete-dialog" aria-labelledby="detail-delete-title" onCancel={() => setError('')}>
        <div className="listing-delete-content">
          <button className="listing-delete-close" type="button" aria-label="إغلاق نافذة الحذف" onClick={() => dialogRef.current?.close()} disabled={isDeleting}><X aria-hidden="true" /></button>
          <span className="listing-delete-icon"><Trash2 aria-hidden="true" /></span>
          <span className="listing-delete-eyebrow">تأكيد الإجراء</span>
          <h2 id="detail-delete-title">حذف الإعلان</h2>
          <p>{isAdmin ? 'سيُحذف الإعلان وصوره نهائياً من السوق.' : 'سيُزال إعلانك من السوق ويُنقل إلى الأرشيف. لا يمكن التراجع عن هذا الإجراء من هذه الصفحة.'}</p>
          {error && <p className="form-alert" role="alert">{error}</p>}
          <div className="listing-delete-actions">
            <button className="listing-delete-cancel" type="button" disabled={isDeleting} onClick={() => dialogRef.current?.close()}>تراجع</button>
            <button className="listing-delete-confirm" type="button" disabled={isDeleting} onClick={confirmDeletion}>{isDeleting ? 'جارٍ التنفيذ…' : 'تأكيد الحذف'}</button>
          </div>
        </div>
      </dialog>
    </>
  )
}
