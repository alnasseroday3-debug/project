export type ListingPreferences = {
  whatsappNumber: string
  governorate: string
}

export const themePreferenceStorageKey = 'masar-theme-preference-v1'

export const listingPreferencesStorageKey = (userId: string) => `masar-listing-preferences-v1:${userId}`

export const syrianGovernorates = [
  'دمشق', 'ريف دمشق', 'حلب', 'حمص', 'اللاذقية', 'طرطوس', 'حماة', 'إدلب',
  'درعا', 'السويداء', 'دير الزور', 'الحسكة', 'الرقة', 'القنيطرة',
] as const
