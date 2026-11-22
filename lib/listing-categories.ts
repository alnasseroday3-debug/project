export const listingCategories = [
  { id: 'cars', label: 'السيارات والمركبات' },
  { id: 'real_estate', label: 'العقارات والمنازل' },
  { id: 'furniture', label: 'الأثاث المنزلي والمفروشات' },
  { id: 'appliances', label: 'الأدوات الكهربائية والطاقة' },
  { id: 'electronics', label: 'الأجهزة الإلكترونية' },
  { id: 'fashion', label: 'الملابس والأحذية والمحلات' },
] as const

export type ListingCategory = (typeof listingCategories)[number]['id']
export type ListingDetails = Record<string, string>

export const listingCategoryLabels: Record<ListingCategory, string> = Object.fromEntries(
  listingCategories.map(({ id, label }) => [id, label]),
) as Record<ListingCategory, string>

export const isListingCategory = (value: unknown): value is ListingCategory =>
  typeof value === 'string' && listingCategories.some((category) => category.id === value)
