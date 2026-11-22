export function sanitizePlainText(value: unknown, maximum: number) {
  if (typeof value !== 'string') return ''

  return value
    .normalize('NFKC')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<(script|style|iframe|object|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximum)
}
