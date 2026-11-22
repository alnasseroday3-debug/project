'use client'

import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import type { ListingCategory } from '@/lib/listing-categories'

const categories: { id: ListingCategory; label: string; image: string }[] = [
  { id: 'cars', label: 'سيارات', image: '/images/category-cars.png' },
  { id: 'real_estate', label: 'منازل وعقارات', image: '/images/category-real-estate.png' },
  { id: 'furniture', label: 'أثاث منزلي', image: '/images/category-furniture.png' },
  { id: 'appliances', label: 'أدوات كهربائية', image: '/images/category-appliances.png' },
  { id: 'electronics', label: 'إلكترونيات', image: '/images/category-electronics.png' },
  { id: 'fashion', label: 'ألبسة وأحذية', image: '/images/category-fashion.png' },
]

export function CategoryGrid({ selectedCategory, onSelect }: {
  selectedCategory: 'all' | ListingCategory
  onSelect: (category: ListingCategory) => void
}) {
  return (
    <nav className="category-grid" aria-label="تصفّح أقسام السوق">
      {categories.map((category) => (
        <button
          className={`category-card${selectedCategory === category.id ? ' is-selected' : ''}`}
          key={category.id}
          type="button"
          aria-pressed={selectedCategory === category.id}
          onClick={() => onSelect(category.id)}
        >
          <Image src={category.image} alt="" fill sizes="(max-width: 650px) 50vw, (max-width: 1050px) 33vw, 380px" />
          <span className="category-card-shade" />
          <span className="category-card-label">{category.label}<ArrowLeft aria-hidden="true" /></span>
        </button>
      ))}
    </nav>
  )
}
