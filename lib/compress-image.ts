export const MAX_IMAGE_SOURCE_BYTES = 20 * 1024 * 1024
export const TARGET_IMAGE_BYTES = 480 * 1024

const maxDimension = 1_920
const minimumQuality = 0.35
const maximumQuality = 0.9

type DecodedImage = CanvasImageSource & {
  width: number
  height: number
  close?: () => void
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // Fall back to the browser's Image decoder.
    }
  }

  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = sourceUrl
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

function encodeJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('تعذّر تجهيز الصورة للرفع. جرّب صورة أخرى.'))
    }, 'image/jpeg', quality)
  })
}

export async function compressImage(file: File): Promise<File> {
  if (file.size <= TARGET_IMAGE_BYTES) return file

  const source = await decodeImage(file)
  try {
    if (!source.width || !source.height) throw new Error('تعذّر قراءة أبعاد الصورة.')

    const initialScale = Math.min(1, maxDimension / Math.max(source.width, source.height))
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('متصفحك لا يدعم ضغط الصور.')

    let scale = initialScale
    for (let attempt = 0; attempt < 9; attempt += 1) {
      canvas.width = Math.max(1, Math.round(source.width * scale))
      canvas.height = Math.max(1, Math.round(source.height * scale))
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(source, 0, 0, canvas.width, canvas.height)

      let bestBlob = await encodeJpeg(canvas, minimumQuality)
      if (bestBlob.size <= TARGET_IMAGE_BYTES) {
        let low = minimumQuality
        let high = maximumQuality
        for (let iteration = 0; iteration < 7; iteration += 1) {
          const quality = (low + high) / 2
          const candidate = await encodeJpeg(canvas, quality)
          if (candidate.size <= TARGET_IMAGE_BYTES) {
            bestBlob = candidate
            low = quality
          } else {
            high = quality
          }
        }

        const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
        return new File([bestBlob], `${baseName}.jpg`, {
          type: 'image/jpeg',
          lastModified: file.lastModified,
        })
      }
      scale *= 0.8
    }

    throw new Error('تعذّر ضغط الصورة إلى أقل من 500 كيلوبايت. اختر صورة أصغر.')
  } finally {
    source.close?.()
  }
}
