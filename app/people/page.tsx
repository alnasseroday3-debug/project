import type { Metadata } from 'next'
import { ProfileSearch } from '@/components/social/profile-search'

export const metadata: Metadata = { title: 'البحث عن المعلنين', description: 'ابحث عن المعلنين والمتاجر في مجتمع مَسار.' }

export default function PeoplePage() {
  return <main className="social-page page-container"><header className="social-page-heading"><span className="eyebrow eyebrow-green">مجتمع مَسار</span><h1>اعثر على حساب</h1><p>تابع المعلنين والمتاجر لتظهر إعلاناتهم في مقدمة السوق.</p></header><ProfileSearch /></main>
}
