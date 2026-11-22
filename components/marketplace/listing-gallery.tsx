'use client'

import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import { CarPhoto } from '@/components/marketplace/car-photo'

export function ListingGallery({ images, title }: { images: string[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const zoomDialogRef = useRef<HTMLDialogElement>(null)
  const currentImage = images[activeIndex]

  function changeImage(direction: -1 | 1) {
    setActiveIndex((current) => (current + direction + images.length) % images.length)
  }

  return (
    <div className="listing-gallery">
      <div className="listing-gallery-frame">
        {currentImage ? (
          <button className="listing-gallery-image-button" type="button" onClick={() => zoomDialogRef.current?.showModal()} aria-label="تكبير صورة الإعلان">
            <CarPhoto src={currentImage} alt={`${title}، صورة ${activeIndex + 1} من ${images.length}`} width={1000} height={760} className="detail-photo" />
            <span className="listing-gallery-zoom"><Maximize2 aria-hidden="true" /> تكبير</span>
          </button>
        ) : <div className="detail-photo-fallback" role="img" aria-label="لا توجد صورة للإعلان" />}
        {images.length > 1 && (
          <>
            <button className="listing-gallery-arrow is-previous" type="button" onClick={() => changeImage(-1)} aria-label="الصورة السابقة"><ChevronRight aria-hidden="true" /></button>
            <button className="listing-gallery-arrow is-next" type="button" onClick={() => changeImage(1)} aria-label="الصورة التالية"><ChevronLeft aria-hidden="true" /></button>
            <span className="listing-gallery-count" aria-live="polite">{activeIndex + 1} / {images.length}</span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="listing-gallery-thumbnails" role="group" aria-label="اختيار صورة الإعلان">
          {images.map((image, index) => (
            <button
              className={activeIndex === index ? 'is-active' : ''}
              key={`${image}-${index}`}
              type="button"
              aria-label={`عرض الصورة ${index + 1}`}
              aria-pressed={activeIndex === index}
              onClick={() => setActiveIndex(index)}
            >
              <CarPhoto src={image} alt="" width={144} height={100} />
            </button>
          ))}
        </div>
      )}

      <dialog ref={zoomDialogRef} className="listing-zoom-dialog" aria-label="معاينة صورة الإعلان المكبرة">
        <div className="listing-zoom-content">
          <button className="listing-zoom-close" type="button" aria-label="إغلاق تكبير الصورة" onClick={() => zoomDialogRef.current?.close()}><X aria-hidden="true" /></button>
          {images.length > 1 && <button className="listing-gallery-arrow is-previous" type="button" onClick={() => changeImage(-1)} aria-label="الصورة السابقة"><ChevronRight aria-hidden="true" /></button>}
          {currentImage && <CarPhoto src={currentImage} alt={`${title}، صورة ${activeIndex + 1} من ${images.length}`} width={1600} height={1200} className="listing-zoom-photo" />}
          {images.length > 1 && <button className="listing-gallery-arrow is-next" type="button" onClick={() => changeImage(1)} aria-label="الصورة التالية"><ChevronLeft aria-hidden="true" /></button>}
          {images.length > 1 && <span className="listing-zoom-count" aria-live="polite">{activeIndex + 1} / {images.length}</span>}
        </div>
      </dialog>
    </div>
  )
}
