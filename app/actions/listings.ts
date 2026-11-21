'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'
import { consumeRateLimit, getClientAddress } from '@/lib/rate-limit'
import { cookies, headers } from 'next/headers'
import { isOwnedPublicBlobUrl, verificationUploadCookie } from '@/lib/blob-storage'

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
export async function submitListing(draft: ListingDraft) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { success: false, message: 'سجّل الدخول أولاً لإرسال إعلانك.' }
  if (!draft || typeof draft !== 'object') return { success: false, message: 'بيانات الإعلان غير صالحة.' }
  const cookieStore = await cookies()
  const verificationImage = cookieStore.get(verificationUploadCookie)?.value

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
    if (new Set(images).size !== images.length || images.some((url) => typeof url !== 'string' || !isOwnedPublicBlobUrl(url, 'cars', session.user.id))) {
      return { success: false, message: 'أعد رفع صور السيارة من حسابك.' }
    }
    if (!verificationImage || !isOwnedPublicBlobUrl(verificationImage, 'verification', session.user.id)) {
      return { success: false, message: 'أعد رفع صورة التحقق من حسابك.' }
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
      verificationImage,
      verified: false,
      status: 'pending',
      sellerName: cleanText(session.user.name, 100),
      sellerPhone,
    })
    cookieStore.delete(verificationUploadCookie)
    revalidatePath('/')
    revalidatePath('/admin')
    return { success: true, message: 'وصل إعلانك إلى فريق مَسَار للمراجعة.' }
  } catch (error) {
    console.error('[v0] Failed to create car listing:', error)
    return { success: false, message: 'تعذّر حفظ الإعلان الآن. حاول مرة أخرى.' }
  }
}
