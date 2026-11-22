'use client'

import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'

export function ShareListingButton() {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function copyLink() {
    setError('')
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setError('تعذّر نسخ الرابط من هذا المتصفح.')
    }
  }

  return (
    <div className="share-listing-wrap">
      <button className="share-listing-button" type="button" onClick={copyLink}>
        {copied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
        {copied ? 'تم نسخ رابط الإعلان' : 'مشاركة الإعلان'}
        {!copied && <Copy aria-hidden="true" />}
      </button>
      {error && <span className="share-listing-error" role="status">{error}</span>}
    </div>
  )
}
