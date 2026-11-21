import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { del } from '@vercel/blob'

export const verificationUploadCookie = 'masar_verification_upload'

function verificationImageKey() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('صورة التحقق غير متاحة بسبب إعداد تشفير مفقود.')
  return createHash('sha256').update('masar-verification-image-v1\0').update(secret).digest()
}

export function encryptVerificationImage(image: Uint8Array) {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', verificationImageKey(), nonce)
  const encrypted = Buffer.concat([cipher.update(image), cipher.final()])
  return Buffer.concat([Buffer.from('MSV1'), nonce, cipher.getAuthTag(), encrypted])
}

export function decryptVerificationImage(envelope: Uint8Array) {
  const bytes = Buffer.from(envelope)
  if (bytes.length < 32 || bytes.subarray(0, 4).toString('ascii') !== 'MSV1') {
    throw new Error('صيغة صورة التحقق المشفرة غير صالحة.')
  }

  const nonce = bytes.subarray(4, 16)
  const tag = bytes.subarray(16, 32)
  const encrypted = bytes.subarray(32)
  const decipher = createDecipheriv('aes-256-gcm', verificationImageKey(), nonce)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()])
}

export function isOwnedPublicBlobUrl(value: unknown, folder: 'cars' | 'verification', userId: string) {
  if (typeof value !== 'string' || value.length > 2_000) return false

  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      !url.hostname.endsWith('.public.blob.vercel-storage.com') ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) return false

    const path = decodeURIComponent(url.pathname.slice(1))
    const [actualFolder, ownerId, filename, extra] = path.split('/')
    if (actualFolder !== folder || ownerId !== userId || extra) return false

    const pattern = folder === 'cars'
      ? /^[0-9a-f-]{36}\.(jpg|png|webp)$/i
      : /^[0-9a-f-]{36}\.(jpg|png|webp)\.enc$/i
    return pattern.test(filename ?? '')
  } catch {
    return false
  }
}

export function verificationImageContentType(url: string) {
  const pathname = new URL(url).pathname.toLowerCase()
  if (pathname.endsWith('.jpg.enc')) return 'image/jpeg'
  if (pathname.endsWith('.png.enc')) return 'image/png'
  if (pathname.endsWith('.webp.enc')) return 'image/webp'
  throw new Error('صيغة صورة التحقق غير معروفة.')
}

export async function deleteListingBlobs(images: string[], verificationImage: string | null, userId: string) {
  const urls = [...new Set([
    ...images.filter((url) => isOwnedPublicBlobUrl(url, 'cars', userId)),
    ...(verificationImage && isOwnedPublicBlobUrl(verificationImage, 'verification', userId) ? [verificationImage] : []),
  ])]
  if (urls.length === 0) return true

  try {
    await del(urls)
    return true
  } catch (error) {
    console.error('[v0] Failed to delete listing blobs:', error)
    return false
  }
}
