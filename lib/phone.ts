const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
const persianDigits = '۰۱۲۳۴۵۶۷۸۹'

export function normalizePhoneNumber(value: string) {
  const asciiDigits = value.trim().replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabicIndex = arabicDigits.indexOf(digit)
    const digitIndex = arabicIndex >= 0 ? arabicIndex : persianDigits.indexOf(digit)
    return String(digitIndex)
  })
  let digits = asciiDigits.replace(/\D/g, '')

  if (digits.startsWith('00')) digits = digits.slice(2)
  if (/^09\d{8}$/.test(digits)) return `+963${digits.slice(1)}`
  if (asciiDigits.trim().startsWith('+') || digits.length > 0 && asciiDigits.trim().startsWith('00')) return `+${digits}`
  return digits
}

export function isValidPhoneNumber(value: string) {
  return /^\+?[1-9]\d{7,14}$/.test(value)
}
