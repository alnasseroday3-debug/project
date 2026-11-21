'use client'

import { CarPhoto } from '@/components/marketplace/car-photo'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArrowUpLeft, BadgeCheck, Check, Clock3, MapPin, ShieldCheck, X } from 'lucide-react'
import { updateListingStatus } from '@/app/actions/listings'
import { carImageUrl } from '@/lib/car-image-url'
import type { CarListing } from '@/lib/db/schema'

const money = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 })

export function AdminDashboard({ listings }: { listings: CarListing[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeId, setActiveId] = useState('')
  const [feedback, setFeedback] = useState('')

  function review(id: string, status: 'approved' | 'rejected') {
    setActiveId(id)
    setFeedback('')
    startTransition(async () => {
      const result = await updateListingStatus(id, status)
      setFeedback(result.message)
      setActiveId('')
      if (result.success) router.refresh()
    })
  }

  return (
    <main className="admin-page page-container">
      <div className="admin-topline"><span className="eyebrow eyebrow-green"><ShieldCheck aria-hidden="true" /> مساحة فريق مَسَار</span><Link className="admin-back" href="/"><ArrowUpLeft aria-hidden="true" /> العودة للسوق</Link></div>
      <div className="admin-heading"><div><h1>مراجعة الإعلانات.</h1><p>تأكد من اكتمال التفاصيل قبل نشر السيارة للمشترين.</p></div><div className="admin-count"><Clock3 aria-hidden="true" /><span><strong>{listings.length}</strong><small>بانتظار المراجعة</small></span></div></div>
      {feedback && <p className="form-success admin-feedback" role="status">{feedback}</p>}
      {listings.length ? <div className="admin-list">{listings.map((car) => <article className="admin-card" key={car.id}>
        <div className="admin-card-photo"><CarPhoto src={carImageUrl(car)} alt={`${car.make} ${car.model}`} width={520} height={360} /></div>
        <div className="admin-card-info">
          <div className="admin-card-title"><div><span className="listing-make">{car.make}</span><h2>{car.model} <small>{car.year}</small></h2></div><span className="pending-pill"><Clock3 aria-hidden="true" /> قيد المراجعة</span></div>
          <p className="admin-description">{car.description || 'لا توجد نبذة عن السيارة.'}</p>
          <div className="admin-facts"><span>{money.format(car.askingPrice)} ر.س</span><span>{money.format(car.mileage)} كم</span><span><MapPin aria-hidden="true" /> {car.city}</span><span><BadgeCheck aria-hidden="true" /> {car.sellerName}</span></div>
          <div className="admin-review-actions"><Link className="review-details" href={`/cars/${car.id}`} target="_blank" rel="noreferrer">تفاصيل الإعلان <ArrowUpLeft aria-hidden="true" /></Link><button type="button" className="review-reject" disabled={isPending} onClick={() => review(car.id, 'rejected')}><X aria-hidden="true" /> {activeId === car.id ? 'جارٍ التحديث…' : 'رفض'}</button><button type="button" className="review-approve" disabled={isPending} onClick={() => review(car.id, 'approved')}><Check aria-hidden="true" /> {activeId === car.id ? 'جارٍ التحديث…' : 'موافقة ونشر'}</button></div>
        </div>
      </article>)}</div> : <section className="admin-empty"><span><Check aria-hidden="true" /></span><h2>أنت على اطلاع.</h2><p>لا توجد إعلانات تنتظر المراجعة حالياً.</p><Link className="primary-button" href="/">تصفح السوق <ArrowUpLeft aria-hidden="true" /></Link></section>}
    </main>
  )
}
