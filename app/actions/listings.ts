'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'
import { consumeRateLimit, getClientAddress } from '@/lib/rate-limit'
import { cookies, headers } from 'next/headers'
import { deleteListingBlobs, isOwnedPublicBlobUrl, verificationUploadCookie } from '@/lib/blob-storage'

type ListingDraft = {
  make: string
  model: string
  year: number
  condition: 'new' | 'used'
  mileage: number
  mileageUnknown: boolean
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
  negotiable: boolean
  paintCondition: string
  paintDetails: string
  transmission: string
  fuelType: string
  registrationStatus: string
  whatsappOnly: boolean
  city: string
  description: string
  sellerPhone: string
  images: string[]
  verificationImageUpdated?: boolean
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
const isVehicleDetailsValid = (draft: ListingDraft) =>
  typeof draft.mileageUnknown === 'boolean' &&
  typeof draft.negotiable === 'boolean' &&
  typeof draft.whatsappOnly === 'boolean' &&
  new Set(['clean', 'interior', 'panels']).has(draft.paintCondition) &&
  new Set(['automatic', 'manual']).has(draft.transmission) &&
  new Set(['gasoline', 'diesel', 'hybrid', 'electric']).has(draft.fuelType) &&
  new Set(['syrian', 'new-entry', 'customs-cleared', 'immediate-transfer']).has(draft.registrationStatus)
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

    if (!make || !model || !city || !phoneIsValid || !priceIsValid || !yearIsValid || !conditionIsValid || !mileageIsValid || !monthsIsValid || !booleansAreValid || !isVehicleDetailsValid(draft)) {
      return { success: false, message: 'راجِع بيانات السيارة والسعر ورقم التواصل.' }
    }
    if (!negotiationIsValid(draft.negotiationMin) || !negotiationIsValid(draft.negotiationMax) || images.length < 1 || images.length > 8) {
      return { success: false, message: 'أضف من صورة واحدة إلى 8 صور، وتحقق من نطاق السعر.' }
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
      mileage: draft.condition === 'new' || draft.mileageUnknown ? 0 : draft.mileage,
      mileageUnknown: draft.mileageUnknown,
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
      negotiable: draft.negotiable,
      paintCondition: draft.paintCondition,
      paintDetails: cleanText(draft.paintDetails, 250) || null,
      transmission: draft.transmission,
      fuelType: draft.fuelType,
      registrationStatus: draft.registrationStatus,
      whatsappOnly: draft.whatsappOnly,
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
    revalidatePath('/my-listings')
    return { success: true, message: 'وصل إعلانك إلى فريق مَسَار للمراجعة.' }
  } catch (error) {
    console.error('[v0] Failed to create car listing:', error)
    return { success: false, message: 'تعذّر حفظ الإعلان الآن. حاول مرة أخرى.' }
  }
}

export async function removeOwnedListing(listingId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { success: false, message: 'سجّل الدخول أولاً لإدارة إعلانك.' }
  if (typeof listingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(listingId)) {
    return { success: false, message: 'معرّف الإعلان غير صالح.' }
  }

  try {
    const [listing] = await db
      .select({ status: carListings.status, images: carListings.images, verificationImage: carListings.verificationImage })
      .from(carListings)
      .where(and(eq(carListings.id, listingId), eq(carListings.userId, session.user.id)))
      .limit(1)
    if (!listing) return { success: false, message: 'الإعلان غير موجود أو لا تملك صلاحية إدارته.' }

    if (listing.status === 'approved') {
      const archived = await db
        .update(carListings)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(and(eq(carListings.id, listingId), eq(carListings.userId, session.user.id), eq(carListings.status, 'approved')))
        .returning({ id: carListings.id })
      if (!archived.length) return { success: false, message: 'تغيرت حالة الإعلان. حدّث الصفحة وحاول مجدداً.' }
      revalidatePath('/')
      revalidatePath('/admin')
      revalidatePath('/my-listings')
      revalidatePath(`/cars/${listingId}`)
      return { success: true, message: 'تمت إزالة الإعلان من العرض ونقله إلى أرشيف الإدارة.' }
    }

    if (listing.status !== 'pending' && listing.status !== 'rejected') {
      return { success: false, message: 'لا يمكن حذف هذا الإعلان بهذه الطريقة.' }
    }

    const deleted = await db
      .delete(carListings)
      .where(and(eq(carListings.id, listingId), eq(carListings.userId, session.user.id), eq(carListings.status, listing.status)))
      .returning({ id: carListings.id })
    if (!deleted.length) return { success: false, message: 'تغيرت حالة الإعلان. حدّث الصفحة وحاول مجدداً.' }

    const blobsDeleted = await deleteListingBlobs(listing.images, listing.verificationImage, session.user.id)
    revalidatePath('/')
    revalidatePath('/admin')
    revalidatePath('/my-listings')
    revalidatePath(`/cars/${listingId}`)
    return {
      success: true,
      message: blobsDeleted ? 'تم حذف الإعلان نهائياً.' : 'تم حذف الإعلان، لكن تعذّر حذف بعض الصور تلقائياً.',
    }
  } catch (error) {
    console.error('[v0] Failed to remove owned listing:', error)
    return { success: false, message: 'تعذّر حذف الإعلان الآن. حاول مرة أخرى.' }
  }
}

export async function resubmitRejectedListing(listingId: string, draft: ListingDraft) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { success: false, message: 'سجّل الدخول أولاً لإعادة إرسال إعلانك.' }
  if (typeof listingId !== 'string' || !listingId || listingId.length > 80 || !draft || typeof draft !== 'object') {
    return { success: false, message: 'بيانات الإعلان غير صالحة.' }
  }

  const cookieStore = await cookies()
  const uploadedVerificationImage = draft.verificationImageUpdated ? cookieStore.get(verificationUploadCookie)?.value : undefined

  try {
    const [listing] = await db
      .select({ verificationImage: carListings.verificationImage })
      .from(carListings)
      .where(and(eq(carListings.id, listingId), eq(carListings.userId, session.user.id), eq(carListings.status, 'rejected')))
      .limit(1)
    if (!listing) return { success: false, message: 'لا يمكن تعديل هذا الإعلان؛ تأكد أنه مرفوض ومن حسابك.' }

    const requestHeaders = await headers()
    const limits = await Promise.all([
      consumeRateLimit('listing-resubmit-user', session.user.id, 3, 15 * 60_000),
      consumeRateLimit('listing-resubmit-ip', getClientAddress(requestHeaders), 10, 60 * 60_000),
    ])
    if (limits.some((allowed) => !allowed)) return { success: false, message: 'تجاوزت حد إعادة إرسال الإعلانات. حاول لاحقاً.' }

    if (draft.verificationImageUpdated && !uploadedVerificationImage) {
      return { success: false, message: 'أعد رفع صورة التحقق من حسابك.' }
    }
    if (uploadedVerificationImage && !isOwnedPublicBlobUrl(uploadedVerificationImage, 'verification', session.user.id)) {
      return { success: false, message: 'أعد رفع صورة التحقق من حسابك.' }
    }
    const verificationImage = uploadedVerificationImage || listing.verificationImage || undefined
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

    if (!make || !model || !city || !phoneIsValid || !priceIsValid || !yearIsValid || !conditionIsValid || !mileageIsValid || !monthsIsValid || !booleansAreValid || !isVehicleDetailsValid(draft)) {
      return { success: false, message: 'راجِع بيانات السيارة والسعر ورقم التواصل.' }
    }
    if (!negotiationIsValid(draft.negotiationMin) || !negotiationIsValid(draft.negotiationMax) || images.length < 1 || images.length > 8) {
      return { success: false, message: 'أضف من صورة واحدة إلى 8 صور، وتحقق من نطاق السعر.' }
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

    const updated = await db
      .update(carListings)
      .set({
        make,
        model,
        year: draft.year,
        condition: draft.condition,
        mileage: draft.condition === 'new' || draft.mileageUnknown ? 0 : draft.mileage,
        mileageUnknown: draft.condition === 'used' && draft.mileageUnknown,
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
        negotiable: draft.negotiable,
        paintCondition: draft.paintCondition,
        paintDetails: cleanText(draft.paintDetails, 250) || null,
        transmission: draft.transmission,
        fuelType: draft.fuelType,
        registrationStatus: draft.registrationStatus,
        whatsappOnly: draft.whatsappOnly,
        city,
        description: description || null,
        sellerPhone,
        images,
        verificationImage,
        verified: false,
        status: 'pending',
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(and(eq(carListings.id, listingId), eq(carListings.userId, session.user.id), eq(carListings.status, 'rejected')))
      .returning({ id: carListings.id })

    if (updated.length === 0) return { success: false, message: 'تغيرت حالة الإعلان. حدّث الصفحة وحاول مجدداً.' }
    if (draft.verificationImageUpdated) cookieStore.delete(verificationUploadCookie)
    revalidatePath('/')
    revalidatePath('/admin')
    revalidatePath('/my-listings')
    revalidatePath(`/cars/${listingId}`)
    return { success: true, message: 'تم تحديث إعلانك وإرساله مجدداً إلى فريق مَسَار للمراجعة.' }
  } catch (error) {
    console.error('[v0] Failed to resubmit car listing:', error)
    return { success: false, message: 'تعذّر إعادة إرسال الإعلان الآن. حاول مرة أخرى.' }
  }
}
