'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { Bookmark, Heart, LoaderCircle, MessageCircle, Send, Trash2 } from 'lucide-react'

type SocialComment = { id: string; authorId: string; authorName: string; authorImage: string | null; body: string; createdAt: string; canDelete: boolean }
type ListingSocial = { likeCount: number; commentCount: number; liked: boolean; comments: SocialComment[] }

const FAVORITES_KEY = 'masar_saved_listings_v1'

const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('تعذّر تحميل التفاعلات.')
  return response.json() as Promise<ListingSocial>
}

export function ListingSocialActions({ listingId, isAuthenticated, compact = false, onChange }: { listingId: string; isAuthenticated: boolean; compact?: boolean; onChange?: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  const key = `/api/social/listings/${encodeURIComponent(listingId)}`
  const { data, isLoading, mutate } = useSWR<ListingSocial>(key, fetcher, { refreshInterval: 20_000 })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY)
      const list: string[] = raw ? JSON.parse(raw) : []
      setSaved(list.includes(String(listingId)))
    } catch {
      // تجاهل أخطاء التخزين
    }
  }, [listingId])

  function toggleFavorite() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY)
      const list: string[] = raw ? JSON.parse(raw) : []
      const idStr = String(listingId)
      const next = list.includes(idStr) ? list.filter((item) => item !== idStr) : [...list, idStr]
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
      setSaved(next.includes(idStr))
      window.dispatchEvent(new Event('masar-favorites-updated'))
    } catch {
      // تجاهل
    }
  }

  async function toggleLike() {
    if (!isAuthenticated || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(key, { method: 'POST', credentials: 'same-origin' })
      const result = await response.json().catch(() => ({})) as { liked?: boolean; likeCount?: number; error?: string }
      if (!response.ok) throw new Error(result.error || 'تعذّر تسجيل الإعجاب.')
      await mutate((current) => current ? { ...current, liked: Boolean(result.liked), likeCount: result.likeCount ?? current.likeCount } : current, { revalidate: false })
      onChange?.()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذّر تسجيل الإعجاب.')
    } finally { setBusy(false) }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isAuthenticated || busy || !comment.trim()) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/social/comments', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId, body: comment }) })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'تعذّر إضافة التعليق.')
      setComment('')
      await mutate()
      onChange?.()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذّر إضافة التعليق.')
    } finally { setBusy(false) }
  }

  async function deleteComment(commentId: string) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/social/comments', { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commentId }) })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'تعذّر حذف التعليق.')
      await mutate()
      onChange?.()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذّر حذف التعليق.')
    } finally { setBusy(false) }
  }

  function showComments() {
    setOpen(true)
    dialogRef.current?.showModal()
  }

  return <>
    <div className={compact ? 'listing-social-actions is-compact' : 'listing-social-actions'}>
      <button type="button" className={data?.liked ? 'listing-social-action is-liked' : 'listing-social-action'} onClick={toggleLike} disabled={!isAuthenticated || busy} aria-label={data?.liked ? 'إزالة الإعجاب' : 'أعجبني'} aria-pressed={Boolean(data?.liked)}><Heart aria-hidden="true" /> <span>{data?.likeCount ?? 0}</span></button>
      <button type="button" className="listing-social-action" onClick={showComments} aria-label="عرض التعليقات"><MessageCircle aria-hidden="true" /> <span>{data?.commentCount ?? 0}</span></button>
      <button
        type="button"
        className={saved ? 'listing-social-action is-liked' : 'listing-social-action'}
        onClick={toggleFavorite}
        aria-label={saved ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
        aria-pressed={saved}
        title={saved ? 'محفوظ في المفضلة' : 'حفظ في المفضلة'}
      >
        <Bookmark aria-hidden="true" style={{ fill: saved ? 'currentColor' : 'none' }} />
        {!compact && <span>{saved ? 'محفوظ' : 'المفضلة'}</span>}
      </button>
      {!isAuthenticated && !compact && <a className="listing-social-signin" href="/sign-in">سجّل الدخول للتفاعل</a>}
    </div>
    <dialog ref={dialogRef} className="social-list-dialog social-comments-dialog" aria-labelledby={`comments-title-${listingId}`} onClose={() => setOpen(false)}>
      <div className="social-dialog-heading"><div><span className="eyebrow eyebrow-green">نقاش الإعلان</span><h2 id={`comments-title-${listingId}`}>التعليقات</h2></div><button type="button" className="social-dialog-close" onClick={() => dialogRef.current?.close()} aria-label="إغلاق"><span aria-hidden="true">×</span></button></div>
      {error && <p className="social-inline-error" role="alert">{error}</p>}
      {isAuthenticated ? <form className="social-comment-form" onSubmit={submitComment}><label className="sr-only" htmlFor={`comment-${listingId}`}>اكتب تعليقاً</label><textarea id={`comment-${listingId}`} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1200} placeholder="اكتب تعليقاً محترماً…" required /><button type="submit" disabled={busy || !comment.trim()}>{busy ? <LoaderCircle aria-hidden="true" className="is-spinning" /> : <Send aria-hidden="true" />}إرسال</button></form> : <a className="social-message-link" href="/sign-in">سجّل الدخول لإضافة تعليق</a>}
      <div className="social-comment-list" aria-live="polite">{isLoading ? <p className="social-state" role="status">جارٍ تحميل التعليقات…</p> : data?.comments.length ? data.comments.map((item) => <article className="social-comment" key={item.id}><span className="social-avatar">{item.authorImage ? <img src={item.authorImage} alt="" /> : item.authorName.slice(0, 1)}</span><div><strong>{item.authorName}</strong><p>{item.body}</p><time>{new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time></div>{item.canDelete && <button className="social-comment-delete" type="button" onClick={() => void deleteComment(item.id)} aria-label="حذف التعليق" disabled={busy}><Trash2 aria-hidden="true" /></button>}</article>) : <p className="social-state"><MessageCircle aria-hidden="true" />لا توجد تعليقات بعد.</p>}</div>
    </dialog>
  </>
        }
    
