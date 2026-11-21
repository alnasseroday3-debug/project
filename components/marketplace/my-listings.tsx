'use client'

import Link from 'next/link'
import { ArrowLeft, BadgeCheck, Clock3, FileText, XCircle } from 'lucide-react'
import { CarPhoto } from '@/components/marketplace/car-photo'
import { carImageUrl } from '@/lib/car-image-url'
import type { OwnerCarListing } from '@/lib/db/schema'

const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

const listingStatus = {
  pending: { label: 'قيد المراجعة', className: 'my-listing-status is-pending', icon: Clock3 },
  approved: { label: 'منشور', className: 'my-listing-status is-approved', icon: BadgeCheck },
  rejected: { label: 'مرفوض', className: 'my-listing-status is-rejected', icon: XCircle },
} as const

export function MyListings({ listings }: { listings: OwnerCarListing[] }) {
  return (
    <main className="my-listings-page page-container">
      <div className="my-listings-heading">
        <div><span className="eyebrow eyebrow-green">مساحتك في مَسَار</span><h1>إعلاناتي</h1><p>تابع حالة سياراتك المنشورة أو التي ما زالت قيد المراجعة.</p></div>
        <Link className="primary-button" href="/sell">إضافة سيارة <ArrowLeft aria-hidden="true" /></Link>
      </div>
      {listings.length ? <div className="my-listings-grid">{listings.map((car) => {
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
              {car.status === 'approved' ? <Link className="my-listing-link" href={`/cars/${car.id}`}>عرض الإعلان المنشور <ArrowLeft aria-hidden="true" /></Link> : <span className="my-listing-note">{car.status === 'rejected' ? 'يمكنك التواصل مع فريقنا لمراجعة القرار.' : 'سيظهر إعلانك في السوق بعد اكتمال المراجعة.'}</span>}
            </div>
          </article>
        )
      })}</div> : <section className="my-listings-empty"><span><FileText aria-hidden="true" /></span><h2>لا توجد إعلانات بعد</h2><p>أضف سيارتك وراجع حالتها من هذه الصفحة في أي وقت.</p><Link className="primary-button" href="/sell">أضف أول إعلان <ArrowLeft aria-hidden="true" /></Link></section>}
    </main>
  )
}
