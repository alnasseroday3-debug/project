'use client'

import Image from 'next/image'
import { useState } from 'react'

const fallbackImage = '/images/hero-cars.png'

type CarPhotoProps = {
  src: string
  alt: string
  width: number
  height: number
  className?: string
}

export function CarPhoto({ src, alt, width, height, className }: CarPhotoProps) {
  const [imageSrc, setImageSrc] = useState(src || fallbackImage)

  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      className={className}
      onError={() => setImageSrc(fallbackImage)}
    />
  )
}
