'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ArrowLeft, BadgeCheck, MapPin, MessageCircle, Search, UserRound } from 'lucide-react'
import { FollowButton, FollowListsDialog } from '@/components/social/follow-controls'
import { AvatarEditor } from '@/components/social/avatar-editor'
import type { PublicCarListing } from '@/lib/db/schema'
import { ListingSocialActions } from '@/components/social/listing-social-actions'
import { carImageUrl } from '@/lib/car-image-url'

type Profile = { id: string; name: string; username: string | null; image: string | null; governorate: string | null; email?: string; followerCount: number; followingCount: number; isFollowing: boolean; isSelf: boolean; isAuthenticated: boolean }
type ProfileData = { profile: Profile; listings: (PublicCarListing & { publishedAt: Date | string | null })[] }
const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('تعذّر تحميل الملف الشخصي.')
  return response.json() as Promise<ProfileData>
}

export function SocialProfileView({ userId }: { userId: string }) {
  const router = useRouter()
  const { data, isLoading, error, mutate } = useSWR<ProfileData>(`/api/social/profiles/${encodeURIComponent(userId)}`, fetcher)
  if (isLoading) return <main className="social-page page-container"><p className="social-state" role="status">جارٍ تحميل الملف الشخصي…</p></main>
  if (error || !data) return <main className="social-page page-container"><p className="social-inline-error" role="alert">تعذّر العثور على الملف الشخصي.</p><Link className="social-back-link" href="/"><ArrowLeft aria-hidden="true" /> العودة إلى السوق</Link></main>
  const profile = data.profile
  return <main className="social-page page-container">
    <div className="social-page-topline"><span className="eyebrow eyebrow-green">مجتمع مَسار</span><Link href="/people" className="social-search-link"><Search aria-hidden="true" /> البحث عن حسابات</Link></div>
    <section className="social-profile-hero" aria-labelledby="profile-name">
      {profile.isSelf ? <AvatarEditor image={profile.image} name={profile.name} onUploaded={(image) => { void mutate({ ...data, profile: { ...profile, image } }, { revalidate: false }); router.refresh() }} /> : <span className="social-profile-avatar">{profile.image ? <img src={profile.image} alt={`صورة ${profile.name}`} /> : profile.name.slice(0, 1)}</span>}
      <div className="social-profile-copy"><span className="social-profile-handle">{profile.username ? `@${profile.username}` : 'عضو في مَسار'}</span><h1 id="profile-name">{profile.name}</h1>{profile.governorate && <span className="social-profile-location"><MapPin aria-hidden="true" />{profile.governorate}</span>}{profile.email && <span className="social-profile-email" dir="ltr">{profile.email}</span>}</div>
      <div className="social-profile-actions">{!profile.isSelf && <><FollowButton userId={profile.id} initialFollowing={profile.isFollowing} /><Link className="social-message-link" href={profile.isAuthenticated ? `/messages?to=${encodeURIComponent(profile.id)}` : `/sign-in?next=${encodeURIComponent(`/messages?to=${profile.id}`)}`}><MessageCircle aria-hidden="true" /> مراسلة</Link></>}{profile.isSelf && <Link className="social-message-link" href="/settings">إعدادات الحساب <ArrowLeft aria-hidden="true" /></Link>}</div>
      <FollowListsDialog userId={profile.id} followerCount={profile.followerCount} followingCount={profile.followingCount} />
    </section>
    <section className="social-profile-listings" aria-labelledby="profile-listings-title"><div className="social-section-title"><div><span className="eyebrow eyebrow-green">السوق</span><h2 id="profile-listings-title">إعلانات {profile.isSelf ? 'ي' : profile.name}</h2></div><span>{data.listings.length} إعلان</span></div>{data.listings.length ? <div className="social-listings-grid">{data.listings.map((listing) => <article className="social-listing-card" key={listing.id}><Link href={`/cars/${listing.id}`} className="social-listing-image"><img src={carImageUrl(listing)} alt={listing.make || 'صورة الإعلان'} loading="lazy" />{listing.verified && <span><BadgeCheck aria-hidden="true" /> موثق</span>}</Link><div className="social-listing-content"><Link href={`/cars/${listing.id}`}><strong>{[listing.make, listing.model].filter(Boolean).join(' ')}</strong><small>{listing.city || 'سوريا'} · {new Intl.NumberFormat('en-US').format(listing.askingPrice)} $</small></Link><ListingSocialActions listingId={listing.id} isAuthenticated={profile.isAuthenticated} compact onChange={() => void mutate()} /></div></article>)}</div> : <div className="social-empty"><UserRound aria-hidden="true" /><strong>لا توجد إعلانات منشورة</strong><span>ستظهر هنا الإعلانات المعتمدة لهذا الحساب.</span></div>}</section>
  </main>
}
