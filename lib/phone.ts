const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
const persianDigits = '۰۱۲۳۴۵۶۷۸۹'

export function normalizePhoneNumber(value: string) {
  const asciiDigits = value.trim().replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabicIndex = arabicDigits.indexOf(digit)
    const digitIndex = arabicIndex >= 0 ? arabicIndex : persianDigits.indexOf(digit)
    return String(digitIndex)
  })
  const digits = asciiDigits.replace(/\D/g, '')
  return asciiDigits.startsWith('+') ? `+${digits}` : digits
}

export function isValidPhoneNumber(value: string) {
  return /^\+?[1-9]\d{7,14}$/.test(value)
}
