import type { CarListing } from '@/lib/db/schema'

export function carImageUrl(car: Pick<CarListing, 'id' | 'images'>, image = car.images[0]) {
  if (!image) return '/images/hero-cars.png'
  return image.startsWith('http')
    ? image
    : `/api/car-images?listing=${encodeURIComponent(car.id)}&path=${encodeURIComponent(image)}`
}
