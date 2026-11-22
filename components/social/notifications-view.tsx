'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Bell, BellRing, CheckCheck, UserRound } from 'lucide-react'
import { FollowButton } from '@/components/social/follow-controls'

type SocialNotification = { id: string; actorId: string; actorName: string; actorImage: string | null; type: string; entityId: string | null; createdAt: string; readAt: string | null; isFollowing: boolean }
type Payload = { notifications: SocialNotification[]; unreadCount: number }
const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('تعذّر تحميل الإشعارات.')
  return response.json() as Promise<Payload>
}

export function NotificationsView() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const seenIds = useRef<Set<string> | null>(null)
  const { data, error, isLoading, mutate } = useSWR<Payload>('/api/social/notifications', fetcher, { refreshInterval: 25_000, revalidateOnFocus: true })

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission)
  }, [])

  useEffect(() => {
    if (!data) return
    const current = new Set(data.notifications.filter((item) => !item.readAt).map((item) => item.id))
    if (seenIds.current && permission === 'granted') {
      for (const item of data.notifications) {
        if (!item.readAt && !seenIds.current.has(item.id)) {
          const message = item.type === 'follow' ? `قام ${item.actorName} بمتابعتك على مَسار` : item.type === 'comment' ? `علّق ${item.actorName} على إعلانك` : `تفاعل ${item.actorName} معك على مَسار`
          new Notification('مَسار', { body: message, tag: item.id })
        }
      }
    }
    seenIds.current = current
  }, [data, permission])

  async function requestPermission() {
    if (!('Notification' in window)) return
    setPermission(await Notification.requestPermission())
  }

  async function markAllRead() {
    const response = await fetch('/api/social/notifications', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
    if (response.ok) await mutate()
  }

  async function markRead(id: string) {
    const response = await fetch('/api/social/notifications', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (response.ok) await mutate()
  }

  return <section className="social-notifications-section" aria-labelledby="notifications-list-title">
    <div className="social-notifications-tools"><button type="button" className="social-message-link" onClick={requestPermission} disabled={permission === 'granted'}><BellRing aria-hidden="true" />{permission === 'granted' ? 'تنبيهات المتصفح مفعّلة' : 'تفعيل تنبيهات المتصفح'}</button>{Boolean(data?.unreadCount) && <button type="button" className="social-mark-read" onClick={() => void markAllRead()}><CheckCheck aria-hidden="true" /> تعليم الكل كمقروء</button>}</div>
    <h2 id="notifications-list-title" className="sr-only">قائمة الإشعارات</h2>
    {permission === 'denied' && <p className="social-inline-error" role="status">تم حظر إشعارات المتصفح. يمكنك السماح بها من إعدادات الموقع في المتصفح.</p>}
    {isLoading ? <p className="social-state" role="status">جارٍ تحميل الإشعارات…</p> : error ? <p className="social-inline-error" role="alert">تعذّر تحميل الإشعارات.</p> : data?.notifications.length ? <ul className="social-notification-list">{data.notifications.map((item) => <li className={item.readAt ? '' : 'is-unread'} key={item.id}><span className="social-avatar">{item.actorImage ? <img src={item.actorImage} alt="" /> : item.actorName.slice(0, 1) || <UserRound aria-hidden="true" />}</span><div className="social-notification-copy"><p>{item.type === 'follow' ? <><strong>{item.actorName}</strong> قام بمتابعتك على مَسار</> : item.type === 'comment' ? <><strong>{item.actorName}</strong> علّق على إعلانك</> : <><strong>{item.actorName}</strong> تفاعل معك على مَسار</>}</p><time>{new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time></div>{item.type === 'follow' && <FollowButton userId={item.actorId} initialFollowing={item.isFollowing} />}{item.type === 'comment' && item.entityId && <Link className="social-notification-action" href={`/cars/${encodeURIComponent(item.entityId)}`}>عرض الإعلان</Link>}{!item.readAt && <button className="social-mark-read" type="button" onClick={() => void markRead(item.id)} aria-label="تعليم كمقروء"><CheckCheck aria-hidden="true" /></button>}</li>)}</ul> : <div className="social-empty"><Bell aria-hidden="true" /><strong>لا توجد إشعارات بعد</strong><span>سنخبرك هنا عندما يتابعك أحد أو يتفاعل مع إعلاناتك.</span></div>}
  </section>
}
