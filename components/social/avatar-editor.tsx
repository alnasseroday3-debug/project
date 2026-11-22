'use client'

import { useRef, useState } from 'react'
import { Camera, LoaderCircle } from 'lucide-react'
import { compressImage, MAX_IMAGE_SOURCE_BYTES } from '@/lib/compress-image'

export function AvatarEditor({ image, name, onUploaded }: { image: string | null; name: string; onUploaded: (image: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function upload(file: File | undefined) {
    if (!file) return
    setError('')
    if (file.size > MAX_IMAGE_SOURCE_BYTES) { setError('حجم الصورة كبير جداً. اختر صورة أصغر.'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('اختر صورة JPG أو PNG أو WebP.'); return }
    setBusy(true)
    try {
      const compressed = await compressImage(file)
      const formData = new FormData()
      formData.set('file', compressed)
      const response = await fetch('/api/social/avatar', { method: 'POST', credentials: 'same-origin', body: formData })
      const result = await response.json().catch(() => ({})) as { image?: string; error?: string }
      if (!response.ok || !result.image) throw new Error(result.error || 'تعذّر تحديث الصورة.')
      onUploaded(result.image)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذّر تحديث الصورة.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return <div className="social-avatar-editor"><span className="social-profile-avatar">{image ? <img src={image} alt={`صورة ${name}`} /> : name.slice(0, 1)}</span><button className="social-avatar-edit-button" type="button" onClick={() => inputRef.current?.click()} disabled={busy} aria-label="تغيير صورة الملف الشخصي">{busy ? <LoaderCircle aria-hidden="true" className="is-spinning" /> : <Camera aria-hidden="true" />}<span aria-hidden="true">+</span></button><input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="اختر صورة الملف الشخصي" onChange={(event) => void upload(event.currentTarget.files?.[0])} />{error && <span className="social-inline-error" role="alert">{error}</span>}</div>
}
