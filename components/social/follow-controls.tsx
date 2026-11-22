'use client'

import { useRef, useState } from 'react'
import useSWRInfinite from 'swr/infinite'
import { Check, LoaderCircle, UserRoundPlus, Users } from 'lucide-react'

type FollowPerson = { id: string; name: string; username: string | null; image: string | null; governorate: string | null; isFollowing: boolean }
type FollowPage = { users: FollowPerson[]; hasMore: boolean; offset: number }
const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('تعذّر تحميل القائمة.')
  return response.json()
}

export function FollowButton({ userId, initialFollowing, isSelf = false }: { userId: string; initialFollowing: boolean; isSelf?: boolean }) {
  const [following, setFollowing] = useState(initialFollowing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (isSelf) return null
  async function toggle() {
    if (busy) return
    setBusy(true)
    setError('')
    const next = !following
    try {
      const response = await fetch('/api/social/follows', {
        method: next ? 'POST' : 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: userId }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'تعذّر تحديث المتابعة.')
      setFollowing(next)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذّر تحديث المتابعة.')
    } finally {
      setBusy(false)
    }
  }
  return <span className="social-follow-control"><button className={following ? 'social-follow-button is-following' : 'social-follow-button'} type="button" onClick={toggle} disabled={busy} aria-pressed={following}>{busy ? <LoaderCircle aria-hidden="true" className="is-spinning" /> : following ? <Check aria-hidden="true" /> : <UserRoundPlus aria-hidden="true" />}{following ? 'إلغاء المتابعة' : 'متابعة'}</button>{error && <span className="social-inline-error" role="alert">{error}</span>}</span>
}

export function FollowListsDialog({ userId, followerCount, followingCount }: { userId: string; followerCount: number; followingCount: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'followers' | 'following'>('followers')
  const getKey = (pageIndex: number, previousPage: FollowPage | null) => {
    if (!open || (pageIndex > 0 && !previousPage?.hasMore)) return null
    return `/api/social/follows?userId=${encodeURIComponent(userId)}&type=${type}&offset=${pageIndex * 50}`
  }
  const { data, size, setSize, isLoading, isValidating, error } = useSWRInfinite<FollowPage>(getKey, fetcher)
  const people = data?.flatMap((page) => page.users) ?? []

  function show(next: 'followers' | 'following') {
    setType(next)
    setSize(1)
    setOpen(true)
    dialogRef.current?.showModal()
  }

  return <>
    <div className="social-profile-stats">
      <button type="button" onClick={() => show('followers')}><strong>{followerCount}</strong><span>المتابِعون</span></button>
      <button type="button" onClick={() => show('following')}><strong>{followingCount}</strong><span>يتابع</span></button>
    </div>
    <dialog ref={dialogRef} className="social-list-dialog" aria-labelledby="follow-list-title" onClose={() => setOpen(false)}>
      <div className="social-dialog-heading"><div><span className="eyebrow eyebrow-green">مجتمع مَسار</span><h2 id="follow-list-title">{type === 'followers' ? 'المتابِعون' : 'يتابع'}</h2></div><button type="button" className="social-dialog-close" onClick={() => dialogRef.current?.close()} aria-label="إغلاق"><span aria-hidden="true">×</span></button></div>
      <div className="social-list-tabs" role="group" aria-label="نوع القائمة"><button type="button" aria-pressed={type === 'followers'} onClick={() => { setType('followers'); setSize(1) }}>المتابِعون <span>{followerCount}</span></button><button type="button" aria-pressed={type === 'following'} onClick={() => { setType('following'); setSize(1) }}>يتابع <span>{followingCount}</span></button></div>
      {isLoading ? <p className="social-state" role="status">جارٍ تحميل القائمة…</p> : error ? <p className="social-inline-error" role="alert">تعذّر تحميل القائمة.</p> : people.length ? <><ul className="social-person-list">{people.map((person) => <li key={person.id}><a className="social-person-main" href={`/people/${encodeURIComponent(person.id)}`}><span className="social-avatar">{person.image ? <img src={person.image} alt="" /> : person.name.slice(0, 1)}</span><span><strong>{person.name}</strong><small>{person.governorate || person.username || 'عضو في مَسار'}</small></span></a><FollowButton userId={person.id} initialFollowing={person.isFollowing} /></li>)}</ul>{data?.[data.length - 1]?.hasMore && <button className="social-load-more" type="button" onClick={() => setSize(size + 1)} disabled={isValidating}>{isValidating ? 'جارٍ التحميل…' : 'عرض المزيد'}</button>}</> : <p className="social-state"><Users aria-hidden="true" />لا توجد حسابات في هذه القائمة بعد.</p>}
    </dialog>
  </>
}
