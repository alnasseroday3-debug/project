'use server'

import { get } from '@vercel/blob'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'
import { consumeRateLimit, getClientAddress } from '@/lib/rate-limit'
import { headers } from 'next/headers'

type ListingDraft = {
  make: string
  model: string
  year: number
  condition: 'new' | 'used'
  mileage: number
  usageMonths: number | null
  maintenanceVisited: boolean
  maintenanceReason: string
  repaired: boolean
  repairDetails: string
  partsChanged: boolean
  changedParts: string
  askingPrice: number
  negotiationMin: number | null
  negotiationMax: number | null
  city: string
  description: string
  sellerPhone: string
  images: string[]
  verificationImage: string
}

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === 'string'
    ? value.normalize('NFKC').split('').filter((character) => {
        const code = character.charCodeAt(0)
        return code >= 32 && code !== 127
      }).join('').trim().slice(0, maxLength)
    : ''
const isWholeNumber = (value: unknown, minimum: number, maximum: number) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum
const isOwnedImagePath = (path: string, folder: string, userId: string) => {
  const prefix = `${folder}/${userId}/`
  if (!path.startsWith(prefix)) return false
  const [fileId, extension, extra] = path.slice(prefix.length).split('.')
  return !extra && /^[0-9a-f-]{36}$/i.test(fileId) && ['jpg', 'png', 'webp'].includes(extension?.toLowerCase() ?? '')
}

export async function submitListing(draft: ListingDraft) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { success: false, message: 'سجّل الدخول أولاً لإرسال إعلانك.' }
  if (!draft || typeof draft !== 'object') return { success: false, message: 'بيانات الإعلان غير صالحة.' }

  try {
    const requestHeaders = await headers()
    const limits = await Promise.all([
      consumeRateLimit('listing-user', session.user.id, 3, 15 * 60_000),
      consumeRateLimit('listing-ip', getClientAddress(requestHeaders), 10, 60 * 60_000),
    ])
    if (limits.some((allowed) => !allowed)) return { success: false, message: 'تجاوزت حد إرسال الإعلانات. حاول لاحقاً.' }

    const make = cleanText(draft.make, 50)
    const model = cleanText(draft.model, 60)
    const city = cleanText(draft.city, 60)
    const sellerPhone = cleanText(draft.sellerPhone, 20).replace(/[\s()-]/g, '')
    const description = cleanText(draft.description, 1200)
    const images = Array.isArray(draft.images) ? draft.images : []
    const phoneIsValid = /^\+?[1-9]\d{7,14}$/.test(sellerPhone)
    const priceIsValid = isWholeNumber(draft.askingPrice, 1000, 100_000_000)
    const yearIsValid = isWholeNumber(draft.year, 1980, new Date().getFullYear() + 1)
    const conditionIsValid = draft.condition === 'new' || draft.condition === 'used'
    const mileageIsValid = isWholeNumber(draft.mileage, 0, 2_000_000)
    const monthsIsValid = draft.condition === 'new' || isWholeNumber(draft.usageMonths, 0, 1200)
    const booleansAreValid = typeof draft.maintenanceVisited === 'boolean' && typeof draft.repaired === 'boolean' && typeof draft.partsChanged === 'boolean'
    const negotiationIsValid = (value: unknown) => value === null || isWholeNumber(value, 1000, 100_000_000)

    if (!make || !model || !city || !phoneIsValid || !priceIsValid || !yearIsValid || !conditionIsValid || !mileageIsValid || !monthsIsValid || !booleansAreValid) {
      return { success: false, message: 'راجِع بيانات السيارة والسعر ورقم التواصل.' }
    }
    if (!negotiationIsValid(draft.negotiationMin) || !negotiationIsValid(draft.negotiationMax) || images.length < 1 || images.length > 6) {
      return { success: false, message: 'أضف من صورة واحدة إلى 6 صور، وتحقق من نطاق السعر.' }
    }
    if (draft.negotiationMin && draft.negotiationMax && draft.negotiationMin > draft.negotiationMax) {
      return { success: false, message: 'الحد الأدنى للتفاوض يجب أن يكون أقل من الحد الأعلى.' }
    }
    if (new Set(images).size !== images.length || images.some((path) => typeof path !== 'string' || !isOwnedImagePath(path, 'cars', session.user.id))) {
      return { success: false, message: 'أعد رفع صور السيارة من حسابك.' }
    }
    if (typeof draft.verificationImage !== 'string' || !isOwnedImagePath(draft.verificationImage, 'verification', session.user.id)) {
      return { success: false, message: 'صورة التحقق مطلوبة لإرسال الإعلان.' }
    }
    const storedImages = await Promise.all([...images, draft.verificationImage].map((path) => get(path, { access: 'private' })))
    if (storedImages.some((image) => !image || image.blob.size === null || image.blob.size > 5 * 1024 * 1024 || !image.blob.contentType || !['image/jpeg', 'image/png', 'image/webp'].includes(image.blob.contentType))) {
      return { success: false, message: 'تعذّر التحقق من الصور. أعد رفع الصور ثم حاول مجدداً.' }
    }

    await db.insert(carListings).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      make,
      model,
      year: draft.year,
      condition: draft.condition,
      mileage: draft.condition === 'new' ? 0 : draft.mileage,
      usageMonths: draft.condition === 'used' ? draft.usageMonths ?? 0 : 0,
      maintenanceVisited: draft.maintenanceVisited,
      maintenanceReason: draft.maintenanceVisited ? cleanText(draft.maintenanceReason, 500) || null : null,
      repaired: draft.repaired,
      repairDetails: draft.repaired ? cleanText(draft.repairDetails, 500) || null : null,
      partsChanged: draft.partsChanged,
      changedParts: draft.partsChanged ? cleanText(draft.changedParts, 500) || null : null,
      askingPrice: draft.askingPrice,
      negotiationMin: draft.negotiationMin,
      negotiationMax: draft.negotiationMax,
      city,
      description: description || null,
      images,
      verificationImage: draft.verificationImage,
      verified: false,
      status: 'pending',
      sellerName: cleanText(session.user.name, 100),
      sellerPhone,
    })
    revalidatePath('/')
    revalidatePath('/admin')
    return { success: true, message: 'وصل إعلانك إلى فريق مَسَار للمراجعة.' }
  } catch (error) {
    console.error('[v0] Failed to create car listing:', error)
    return { success: false, message: 'تعذّر حفظ الإعلان الآن. حاول مرة أخرى.' }
  }
}
