'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { Bell, Mail, Search, UserRound } from 'lucide-react'

type HeaderUser = { id: string; name: string; image: string | null }
type NotificationPayload = { unreadCount: number }
const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('تعذّر تحميل الإشعارات.')
  return response.json() as Promise<NotificationPayload>
}

export function SocialHeaderControls({ sessionUser }: { sessionUser: HeaderUser | null }) {
  const { data } = useSWR<NotificationPayload>(sessionUser ? '/api/social/notifications' : null, fetcher, { refreshInterval: 30_000, revalidateOnFocus: true })
  return <div className="social-header-controls">
    <Link href="/people" className="social-header-icon" aria-label="البحث عن معلنين ومتاجر"><Search aria-hidden="true" /></Link>
    {sessionUser && <>
      <Link href="/notifications" className="social-header-icon" aria-label={`الإشعارات${data?.unreadCount ? `، ${data.unreadCount} جديدة` : ''}`}><Bell aria-hidden="true" />{Boolean(data?.unreadCount) && <span className="social-header-badge">{data!.unreadCount > 99 ? '99+' : data!.unreadCount}</span>}</Link>
      <Link href="/messages" className="social-header-icon" aria-label="الرسائل"><Mail aria-hidden="true" /></Link>
      <Link href="/profile" className="social-header-profile" aria-label="ملفي الشخصي"><span>{sessionUser.image ? <img src={sessionUser.image} alt="" /> : sessionUser.name.slice(0, 1) || <UserRound aria-hidden="true" />}</span><i aria-hidden="true">+</i></Link>
    </>}
  </div>
}
