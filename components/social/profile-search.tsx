'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { MapPin, Search, UserRound } from 'lucide-react'

type Person = { id: string; name: string; username: string | null; image: string | null; governorate: string | null }
const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('تعذّر البحث عن الحسابات.')
  return response.json() as Promise<{ users: Person[] }>
}

export function ProfileSearch() {
  const [query, setQuery] = useState('')
  const normalized = query.trim()
  const { data, isLoading, error } = useSWR<{ users: Person[] }>(normalized.length >= 2 ? `/api/social/profiles?q=${encodeURIComponent(normalized)}` : null, fetcher, { keepPreviousData: true })
  return <section className="social-search-section" aria-labelledby="people-search-title">
    <label className="social-search-box"><Search aria-hidden="true" /><span className="sr-only">ابحث عن معلن أو متجر</span><input id="people-search-title" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن اسم معلن أو متجر…" maxLength={80} autoComplete="off" /></label>
    {normalized.length < 2 ? <p className="social-state">اكتب حرفين على الأقل للبحث عن المعلنين والمتاجر.</p> : isLoading ? <p className="social-state" role="status">جارٍ البحث…</p> : error ? <p className="social-inline-error" role="alert">تعذّر تحميل نتائج البحث.</p> : data?.users.length ? <ul className="social-search-results">{data.users.map((person) => <li key={person.id}><Link href={`/people/${encodeURIComponent(person.id)}`} className="social-person-main"><span className="social-avatar">{person.image ? <img src={person.image} alt="" /> : person.name.slice(0, 1)}</span><span><strong>{person.name}</strong><small>{person.governorate ? <><MapPin aria-hidden="true" />{person.governorate}</> : person.username ? `@${person.username}` : 'عضو في مَسار'}</small></span></Link></li>)}</ul> : <p className="social-state"><UserRound aria-hidden="true" />لم نعثر على حساب مطابق.</p>}
  </section>
}
