'use server'

import { and, eq, gte, lt, lte, or, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'
import { consumeRateLimit, getClientAddress } from '@/lib/rate-limit'
import { cookies, headers } from 'next/headers'
import { deleteListingBlobs, isOwnedPublicBlobUrl, verificationUploadCookie } from '@/lib/blob-storage'
import { isListingCategory, type ListingCategory, type ListingDetails } from '@/lib/listing-categories'

type ListingDraft = {
  category?: ListingCategory
  details?: ListingDetails
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

const categoryDetailKeys: Record<ListingCategory, string[]> = {
  cars: ['district'],
  real_estate: ['district', 'propertyType', 'propertyTypeOther', 'areaSqm', 'rooms', 'floor', 'propertyCondition', 'ownershipType', 'ownershipOther', 'condition'],
  furniture: ['district', 'itemType', 'itemTypeOther', 'condition'],
  appliances: ['district', 'itemType', 'itemTypeOther', 'brand', 'condition'],
  electronics: ['district', 'itemType', 'itemTypeOther', 'specifications', 'condition'],
  fashion: ['district', 'itemType', 'itemTypeOther', 'sellerType', 'size', 'condition'],
}

function sanitizeDetails(category: ListingCategory, input: unknown): ListingDetails {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const source = input as Record<string, unknown>
  const details: ListingDetails = {}
  for (const key of categoryDetailKeys[category]) {
    const maximum = key === 'specifications' ? 150 : key === 'district' ? 60 : 120
    const value = cleanText(source[key], maximum)
    if (value) details[key] = value
  }
  return details
}

function hasSelectedOption(details: ListingDetails, key: string, options: string[], otherKey: string) {
  if (details[key] === 'other') return Boolean(details[otherKey]?.trim())
  return options.includes(details[key] ?? '')
}

function areCategoryDetailsValid(category: ListingCategory, details: ListingDetails) {
  if (category === 'cars') return true
  if (category === 'real_estate') {
    return hasSelectedOption(details, 'propertyType', ['شقة', 'بيت عربي', 'مزرعة', 'محل تجاري', 'أرض'], 'propertyTypeOther') &&
      /^\d{1,6}$/.test(details.areaSqm ?? '') && Number(details.areaSqm) > 0 &&
      /^\d{1,3}$/.test(details.rooms ?? '') && Boolean(details.floor?.trim()) &&
      ['سوبر ديلوكس', 'على العضم', 'مفروش', 'عادي'].includes(details.propertyCondition ?? '') &&
      hasSelectedOption(details, 'ownershipType', ['طابو أخضر', 'حكم محكمة', 'كاتب عدل'], 'ownershipOther')
  }
  const typeOptions: Record<Exclude<ListingCategory, 'cars' | 'real_estate'>, string[]> = {
    furniture: ['غرفة نوم', 'طقم كنب', 'سفرة', 'مطبخ', 'سجاد وموكيت', 'مكاتب'],
    appliances: ['براد', 'غسالة', 'مكيف', 'شاشة', 'غاز/فرن', 'منظومة طاقة شمسية/بطاريات/إنفرتر'],
    electronics: ['موبايل', 'لابتوب', 'كمبيوتر', 'تابلت', 'بلايستيشن وألعاب', 'كاميرات وإكسسوارات'],
    fashion: ['رجالي', 'نسائي', 'أطفال', 'أحذية وحقائب', 'بالة أوروبية'],
  }
  if (!hasSelectedOption(details, 'itemType', typeOptions[category], 'itemTypeOther')) return false
  if (category === 'furniture') return ['جديد', 'مستعمل نظيف', 'مستعمل'].includes(details.condition ?? '')
  if (category === 'appliances') return Boolean(details.brand?.trim()) && ['جديد', 'مستعمل'].includes(details.condition ?? '')
  if (category === 'electronics') return Boolean(details.specifications?.trim()) && ['جديد', 'مستعمل نظيف'].includes(details.condition ?? '')
  return ['فرد', 'محل تجاري', 'مول'].includes(details.sellerType ?? '') &&
    ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'مقاس موحد', 'تشكيلة مقاسات متنوعة'].includes(details.size ?? '') &&
    ['جديد', 'بالة فرز أول', 'مستعمل'].includes(details.condition ?? '')
}
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

    const category = draft.category === undefined ? 'cars' : draft.category
    if (!isListingCategory(category)) return { success: false, message: 'اختر قسماً صحيحاً للإعلان.' }
    const details = sanitizeDetails(category, draft.details)
    const make = cleanText(draft.make, 80)
    const model = cleanText(draft.model, 120)
    const city = cleanText(draft.city, 60)
    const sellerPhone = cleanText(draft.sellerPhone, 20).replace(/[\s()-]/g, '')
    const description = cleanText(draft.description, 1200)
    const images = Array.isArray(draft.images) ? draft.images : []
    const phoneIsValid = /^\+?[1-9]\d{7,14}$/.test(sellerPhone)
    const priceIsValid = isWholeNumber(draft.askingPrice, category === 'cars' ? 1000 : 1, 100_000_000)
    const yearIsValid = isWholeNumber(draft.year, 1980, new Date().getFullYear() + 1)
    const conditionIsValid = draft.condition === 'new' || draft.condition === 'used'
    const mileageIsValid = isWholeNumber(draft.mileage, 0, 2_000_000)
    const monthsIsValid = draft.condition === 'new' || isWholeNumber(draft.usageMonths, 0, 1200)
    const booleansAreValid = typeof draft.maintenanceVisited === 'boolean' && typeof draft.repaired === 'boolean' && typeof draft.partsChanged === 'boolean'
    const negotiationIsValid = (value: unknown) => value === null || isWholeNumber(value, 1, 100_000_000)
    const categoryDetailsAreValid = areCategoryDetailsValid(category, details)
    const vehicleDetailsAreValid = category !== 'cars' || isVehicleDetailsValid(draft)

    if (!make || !model || !city || !phoneIsValid || !priceIsValid || !yearIsValid || !conditionIsValid || !mileageIsValid || !monthsIsValid || !booleansAreValid || !categoryDetailsAreValid || !vehicleDetailsAreValid) {
      return { success: false, message: 'راجِع القسم ومواصفات الإعلان والسعر ورقم التواصل.' }
    }
    if (!negotiationIsValid(draft.negotiationMin) || !negotiationIsValid(draft.negotiationMax) || images.length < 1 || images.length > 8) {
      return { success: false, message: 'أضف من صورة واحدة إلى 8 صور، وتحقق من نطاق السعر.' }
    }
    if (category === 'cars' && draft.negotiationMin && draft.negotiationMax && draft.negotiationMin > draft.negotiationMax) {
      return { success: false, message: 'الحد الأدنى للتفاوض يجب أن يكون أقل من الحد الأعلى.' }
    }
    if (new Set(images).size !== images.length || images.some((url) => typeof url !== 'string' || !isOwnedPublicBlobUrl(url, 'cars', session.user.id))) {
      return { success: false, message: 'أعد رفع صور الإعلان من حسابك.' }
    }
    if (!verificationImage || !isOwnedPublicBlobUrl(verificationImage, 'verification', session.user.id)) {
      return { success: false, message: 'أعد رفع صورة التحقق من حسابك.' }
    }
    await db.insert(carListings).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      make,
      model,
      category,
      details,
      year: category === 'cars' ? draft.year : new Date().getFullYear(),
      condition: draft.condition,
      mileage: category === 'cars' && draft.condition === 'used' && !draft.mileageUnknown ? draft.mileage : 0,
      mileageUnknown: category === 'cars' && draft.mileageUnknown,
      usageMonths: category === 'cars' && draft.condition === 'used' ? draft.usageMonths ?? 0 : 0,
      maintenanceVisited: category === 'cars' && draft.maintenanceVisited,
      maintenanceReason: category === 'cars' && draft.maintenanceVisited ? cleanText(draft.maintenanceReason, 500) || null : null,
      repaired: category === 'cars' && draft.repaired,
      repairDetails: category === 'cars' && draft.repaired ? cleanText(draft.repairDetails, 500) || null : null,
      partsChanged: category === 'cars' && draft.partsChanged,
      changedParts: category === 'cars' && draft.partsChanged ? cleanText(draft.changedParts, 500) || null : null,
      askingPrice: draft.askingPrice,
      negotiationMin: category === 'cars' ? draft.negotiationMin : null,
      negotiationMax: category === 'cars' ? draft.negotiationMax : null,
      negotiable: category === 'cars' && draft.negotiable,
      paintCondition: category === 'cars' ? draft.paintCondition : null,
      paintDetails: category === 'cars' ? cleanText(draft.paintDetails, 250) || null : null,
      transmission: category === 'cars' ? draft.transmission : null,
      fuelType: category === 'cars' ? draft.fuelType : null,
      registrationStatus: category === 'cars' ? draft.registrationStatus : null,
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
      .select({ status: carListings.status, archivedByAdmin: carListings.archivedByAdmin, archivedByExpiry: carListings.archivedByExpiry, images: carListings.images, verificationImage: carListings.verificationImage })
      .from(carListings)
      .where(and(eq(carListings.id, listingId), eq(carListings.userId, session.user.id)))
      .limit(1)
    if (!listing) return { success: false, message: 'الإعلان غير موجود أو لا تملك صلاحية إدارته.' }

    if (listing.status === 'approved') {
      const archived = await db
        .update(carListings)
        .set({ status: 'archived', archivedByAdmin: false, archivedByExpiry: false, hiddenByOwner: true, updatedAt: new Date() })
        .where(and(eq(carListings.id, listingId), eq(carListings.userId, session.user.id), eq(carListings.status, 'approved')))
        .returning({ id: carListings.id })
      if (!archived.length) return { success: false, message: 'تغيرت حالة الإعلان. حدّث الصفحة وحاول مجدداً.' }
      revalidatePath('/')
      revalidatePath('/admin')
      revalidatePath('/my-listings')
      revalidatePath(`/cars/${listingId}`)
      return { success: true, message: 'تمت إزالة الإعلان من العرض وحُفظ في أرشيف الإدارة.' }
    }

    if (listing.status === 'archived' && listing.archivedByExpiry) {
      const archived = await db
        .update(carListings)
        .set({ archivedByExpiry: false, hiddenByOwner: true, updatedAt: new Date() })
        .where(and(eq(carListings.id, listingId), eq(carListings.userId, session.user.id), eq(carListings.status, 'archived'), eq(carListings.archivedByExpiry, true)))
        .returning({ id: carListings.id })
      if (!archived.length) return { success: false, message: 'تغيرت حالة الإعلان. حدّث الصفحة وحاول مجدداً.' }
      revalidatePath('/')
      revalidatePath('/admin')
      revalidatePath('/my-listings')
      return { success: true, message: 'تمت إزالة الإعلان من قائمتك وحفظه في أرشيف الإدارة.' }
    }

    if (listing.status === 'archived' && listing.archivedByAdmin) {
      const hidden = await db.update(carListings)
        .set({ hiddenByOwner: true, updatedAt: new Date() })
        .where(and(eq(carListings.id, listingId), eq(carListings.userId, session.user.id), eq(carListings.status, 'archived'), eq(carListings.archivedByAdmin, true)))
        .returning({ id: carListings.id })
      if (!hidden.length) return { success: false, message: 'تغيرت حالة الإعلان. حدّث الصفحة وحاول مجدداً.' }
      revalidatePath('/admin')
      revalidatePath('/my-listings')
      return { success: true, message: 'تم إخفاء الإعلان من قائمتك مع إبقائه في أرشيف الإدارة.' }
    }

    const canDelete = listing.status === 'pending' || listing.status === 'rejected'
    if (!canDelete) return { success: false, message: 'لا يمكن حذف هذا الإعلان بهذه الطريقة.' }

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

export async function renewOwnedListing(listingId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { success: false, message: 'سجّل الدخول أولاً لتجديد إعلانك.' }
  if (typeof listingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(listingId)) {
    return { success: false, message: 'معرّف الإعلان غير صالح.' }
  }

  try {
    const [listing] = await db
      .select({ status: carListings.status, expiresAt: carListings.expiresAt, directRenewals: carListings.directRenewals, archivedByAdmin: carListings.archivedByAdmin, archivedByExpiry: carListings.archivedByExpiry })
      .from(carListings)
      .where(and(eq(carListings.id, listingId), eq(carListings.userId, session.user.id)))
      .limit(1)
    if (!listing || listing.archivedByAdmin || !listing.expiresAt) return { success: false, message: 'لا يمكن تجديد هذا الإعلان.' }

    const now = new Date()
    const renewalWindowEnd = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
    const isExpiredArchive = listing.status === 'archived' && listing.archivedByExpiry && listing.expiresAt <= now
    const isNearExpiry = listing.status === 'approved' && listing.expiresAt <= renewalWindowEnd
    if (!isExpiredArchive && !isNearExpiry) return { success: false, message: 'يظهر زر التجديد خلال آخر خمسة أيام من العرض أو بعد انتهائه.' }

    if (listing.directRenewals < 2) {
      const updated = await db.update(carListings)
        .set({
          status: 'approved',
          expiresAt: sql`GREATEST(COALESCE(${carListings.expiresAt}, ${now}), ${now}) + INTERVAL '30 days'`,
          publishedAt: now,
          directRenewals: sql`${carListings.directRenewals} + 1`,
          archivedByAdmin: false,
          archivedByExpiry: false,
          updatedAt: now,
        })
        .where(and(
          eq(carListings.id, listingId),
          eq(carListings.userId, session.user.id),
          lt(carListings.directRenewals, 2),
          or(
            and(eq(carListings.status, 'approved'), lte(carListings.expiresAt, renewalWindowEnd)),
            and(eq(carListings.status, 'archived'), eq(carListings.archivedByExpiry, true), lte(carListings.expiresAt, now)),
          ),
        ))
        .returning({ id: carListings.id })
      if (updated.length) {
        revalidatePath('/')
        revalidatePath('/admin')
        revalidatePath('/my-listings')
        revalidatePath(`/cars/${listingId}`)
        return { success: true, message: 'تم تجديد العرض لمدة 30 يوماً وإعادته إلى مقدمة الإعلانات.' }
      }
    }

    const requested = await db.update(carListings)
      .set({ status: 'pending', archivedByAdmin: false, archivedByExpiry: false, updatedAt: now })
      .where(and(
        eq(carListings.id, listingId),
        eq(carListings.userId, session.user.id),
        gte(carListings.directRenewals, 2),
        or(
          and(eq(carListings.status, 'approved'), lte(carListings.expiresAt, renewalWindowEnd)),
          and(eq(carListings.status, 'archived'), eq(carListings.archivedByExpiry, true), lte(carListings.expiresAt, now)),
        ),
      ))
      .returning({ id: carListings.id })
    if (!requested.length) return { success: false, message: 'تغيرت حالة الإعلان. حدّث الصفحة وحاول مجدداً.' }

    revalidatePath('/')
    revalidatePath('/admin')
    revalidatePath('/my-listings')
    revalidatePath(`/cars/${listingId}`)
    return { success: true, message: 'استُنفدت مرات التجديد المباشر؛ أُرسل الإعلان إلى الإدارة للموافقة على تجديده.' }
  } catch (error) {
    console.error('[v0] Failed to renew car listing:', error)
    return { success: false, message: 'تعذّر تجديد الإعلان الآن. حاول مرة أخرى.' }
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
    const category = draft.category === undefined ? 'cars' : draft.category
    if (!isListingCategory(category)) return { success: false, message: 'اختر قسماً صحيحاً للإعلان.' }
    const details = sanitizeDetails(category, draft.details)
    const make = cleanText(draft.make, 80)
    const model = cleanText(draft.model, 120)
    const city = cleanText(draft.city, 60)
    const sellerPhone = cleanText(draft.sellerPhone, 20).replace(/[\s()-]/g, '')
    const description = cleanText(draft.description, 1200)
    const images = Array.isArray(draft.images) ? draft.images : []
    const phoneIsValid = /^\+?[1-9]\d{7,14}$/.test(sellerPhone)
    const priceIsValid = isWholeNumber(draft.askingPrice, category === 'cars' ? 1000 : 1, 100_000_000)
    const yearIsValid = isWholeNumber(draft.year, 1980, new Date().getFullYear() + 1)
    const conditionIsValid = draft.condition === 'new' || draft.condition === 'used'
    const mileageIsValid = isWholeNumber(draft.mileage, 0, 2_000_000)
    const monthsIsValid = draft.condition === 'new' || isWholeNumber(draft.usageMonths, 0, 1200)
    const booleansAreValid = typeof draft.maintenanceVisited === 'boolean' && typeof draft.repaired === 'boolean' && typeof draft.partsChanged === 'boolean'
    const negotiationIsValid = (value: unknown) => value === null || isWholeNumber(value, 1, 100_000_000)
    const categoryDetailsAreValid = areCategoryDetailsValid(category, details)
    const vehicleDetailsAreValid = category !== 'cars' || isVehicleDetailsValid(draft)

    if (!make || !model || !city || !phoneIsValid || !priceIsValid || !yearIsValid || !conditionIsValid || !mileageIsValid || !monthsIsValid || !booleansAreValid || !categoryDetailsAreValid || !vehicleDetailsAreValid) {
      return { success: false, message: 'راجِع القسم ومواصفات الإعلان والسعر ورقم التواصل.' }
    }
    if (!negotiationIsValid(draft.negotiationMin) || !negotiationIsValid(draft.negotiationMax) || images.length < 1 || images.length > 8) {
      return { success: false, message: 'أضف من صورة واحدة إلى 8 صور، وتحقق من نطاق السعر.' }
    }
    if (category === 'cars' && draft.negotiationMin && draft.negotiationMax && draft.negotiationMin > draft.negotiationMax) {
      return { success: false, message: 'الحد الأدنى للتفاوض يجب أن يكون أقل من الحد الأعلى.' }
    }
    if (new Set(images).size !== images.length || images.some((url) => typeof url !== 'string' || !isOwnedPublicBlobUrl(url, 'cars', session.user.id))) {
      return { success: false, message: 'أعد رفع صور الإعلان من حسابك.' }
    }
    if (!verificationImage || !isOwnedPublicBlobUrl(verificationImage, 'verification', session.user.id)) {
      return { success: false, message: 'أعد رفع صورة التحقق من حسابك.' }
    }

    const updated = await db
      .update(carListings)
      .set({
        make,
        model,
        category,
        details,
        year: category === 'cars' ? draft.year : new Date().getFullYear(),
        condition: draft.condition,
        mileage: category === 'cars' && draft.condition === 'used' && !draft.mileageUnknown ? draft.mileage : 0,
        mileageUnknown: category === 'cars' && draft.condition === 'used' && draft.mileageUnknown,
        usageMonths: category === 'cars' && draft.condition === 'used' ? draft.usageMonths ?? 0 : 0,
        maintenanceVisited: category === 'cars' && draft.maintenanceVisited,
        maintenanceReason: category === 'cars' && draft.maintenanceVisited ? cleanText(draft.maintenanceReason, 500) || null : null,
        repaired: category === 'cars' && draft.repaired,
        repairDetails: category === 'cars' && draft.repaired ? cleanText(draft.repairDetails, 500) || null : null,
        partsChanged: category === 'cars' && draft.partsChanged,
        changedParts: category === 'cars' && draft.partsChanged ? cleanText(draft.changedParts, 500) || null : null,
        askingPrice: draft.askingPrice,
        negotiationMin: category === 'cars' ? draft.negotiationMin : null,
        negotiationMax: category === 'cars' ? draft.negotiationMax : null,
        negotiable: category === 'cars' && draft.negotiable,
        paintCondition: category === 'cars' ? draft.paintCondition : null,
        paintDetails: category === 'cars' ? cleanText(draft.paintDetails, 250) || null : null,
        transmission: category === 'cars' ? draft.transmission : null,
        fuelType: category === 'cars' ? draft.fuelType : null,
        registrationStatus: category === 'cars' ? draft.registrationStatus : null,
        whatsappOnly: draft.whatsappOnly,
        city,
        description: description || null,
        sellerPhone,
        images,
        verificationImage,
        verified: false,
        status: 'pending',
        rejectionReason: null,
        publishedAt: null,
        expiresAt: null,
        archivedByAdmin: false,
        archivedByExpiry: false,
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
