import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() })
}

export function isAdminEmail(email: string, _emailVerified: boolean, role?: string) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return Boolean(adminEmail && email.trim().toLowerCase() === adminEmail && role === 'admin')
}

export async function isAdminSession() {
  const session = await getCurrentSession()
  return Boolean(session?.user && isAdminEmail(session.user.email, session.user.emailVerified, session.user.role))
}
