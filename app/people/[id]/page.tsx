import type { Metadata } from 'next'
import { SocialProfileView } from '@/components/social/profile-view'

type PageProps = { params: Promise<{ id: string }> }
export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  return { title: 'الملف الشخصي', description: 'إعلانات ومتابعو أعضاء مجتمع مَسار.', alternates: { canonical: `/people/${encodeURIComponent(id)}` } }
}
export default async function PublicProfilePage({ params }: PageProps) {
  const { id } = await params
  return <SocialProfileView userId={id} />
}
