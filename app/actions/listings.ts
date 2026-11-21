'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { carListings } from '@/lib/db/schema'
import { isAdminSession } from '@/lib/auth-helpers'
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
}

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''

export async function submitListing(draft: ListingDraft) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { success: false, message: 'سجّل الدخول أولاً لإرسال إعلانك.' }

  const make = cleanText(draft.make, 50)
  const model = cleanText(draft.model, 60)
  const city = cleanText(draft.city, 60)
  const sellerPhone = cleanText(draft.sellerPhone, 20).replace(/[\s()-]/g, '')
  const description = cleanText(draft.description, 1200)
  const images = Array.isArray(draft.images) ? draft.images.slice(0, 6) : []
  const phoneIsValid = /^\+?[1-9]\d{7,14}$/.test(sellerPhone)
  const pricesAreValid = Number.isInteger(draft.askingPrice) && draft.askingPrice >= 1000 && draft.askingPrice <= 100_000_000
  const yearIsValid = Number.isInteger(draft.year) && draft.year >= 1980 && draft.year <= new Date().getFullYear() + 1

  if (!make || !model || !city || !phoneIsValid || !pricesAreValid || !yearIsValid) {
    return { success: false, message: 'راجِع بيانات السيارة والسعر ورقم التواصل.' }
  }
  if (!['new', 'used'].includes(draft.condition)) {
    return { success: false, message: 'اختر حالة السيارة.' }
  }
  if (images.length === 0 || images.some((path) => typeof path !== 'string' || !path.startsWith(`cars/${session.user.id}/`))) {
    return { success: false, message: 'أضف صورة واحدة على الأقل للسيارة.' }
  }

  try {
    await db.insert(carListings).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      make,
      model,
      year: draft.year,
      condition: draft.condition,
      mileage: Math.max(0, Math.min(2_000_000, Math.trunc(draft.mileage || 0))),
      usageMonths: draft.condition === 'used' ? Math.max(0, Math.min(1200, Math.trunc(draft.usageMonths ?? 0))) : 0,
      maintenanceVisited: Boolean(draft.maintenanceVisited),
      maintenanceReason: draft.maintenanceVisited ? cleanText(draft.maintenanceReason, 500) : null,
      repaired: Boolean(draft.repaired),
      repairDetails: draft.repaired ? cleanText(draft.repairDetails, 500) : null,
      partsChanged: Boolean(draft.partsChanged),
      changedParts: draft.partsChanged ? cleanText(draft.changedParts, 500) : null,
      askingPrice: draft.askingPrice,
      negotiationMin: draft.negotiationMin && draft.negotiationMin > 0 ? draft.negotiationMin : null,
      negotiationMax: draft.negotiationMax && draft.negotiationMax > 0 ? draft.negotiationMax : null,
      city,
      description,
      images,
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

export async function updateListingStatus(id: string, status: 'approved' | 'rejected') {
  if (!(await isAdminSession())) return { success: false, message: 'ليست لديك صلاحية إدارة الإعلانات.' }
  if (!id || !['approved', 'rejected'].includes(status)) {
    return { success: false, message: 'تعذّر تحديث حالة الإعلان.' }
  }

  try {
    const updated = await db
      .update(carListings)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(carListings.id, id), eq(carListings.status, 'pending')))
      .returning({ id: carListings.id })
    if (updated.length === 0) return { success: false, message: 'هذا الإعلان لم يعد قيد المراجعة.' }
    revalidatePath('/')
    revalidatePath('/admin')
    revalidatePath(`/cars/${id}`)
    return { success: true, message: status === 'approved' ? 'تم نشر الإعلان.' : 'تم رفض الإعلان.' }
  } catch (error) {
    console.error('[v0] Failed to review car listing:', error)
    return { success: false, message: 'تعذّر تحديث الإعلان الآن.' }
  }
}
