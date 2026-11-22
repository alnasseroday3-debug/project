export function listingAgeLabel(value: Date | string | null) {
  if (!value) return 'تاريخ النشر غير متاح'

  const publishedAt = new Date(value)
  if (Number.isNaN(publishedAt.getTime())) return 'تاريخ النشر غير متاح'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  publishedAt.setHours(0, 0, 0, 0)
  const days = Math.max(0, Math.floor((today.getTime() - publishedAt.getTime()) / 86_400_000))

  if (days === 0) return 'اليوم'
  if (days === 1) return 'منذ يوم'
  if (days === 2) return 'منذ يومين'
  if (days < 7) return `منذ ${days} أيام`
  if (days < 14) return 'منذ أسبوع'
  if (days < 21) return 'منذ أسبوعين'
  if (days < 30) return 'منذ 3 أسابيع'

  const months = Math.floor(days / 30)
  if (months === 1) return 'منذ شهر'
  if (months === 2) return 'منذ شهرين'
  if (months < 12) return `منذ ${months} أشهر`

  const years = Math.floor(months / 12)
  if (years === 1) return 'منذ سنة'
  if (years === 2) return 'منذ سنتين'
  return `منذ ${years} سنوات`
}
