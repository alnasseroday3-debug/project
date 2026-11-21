import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() })
}

export function isAdminEmail(email: string, emailVerified: boolean) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const productionVerification = process.env.NODE_ENV !== 'production' || emailVerified
  return Boolean(adminEmail && email.toLowerCase() === adminEmail && productionVerification)
}

export async function isAdminSession() {
  const session = await getCurrentSession()
  return Boolean(session?.user && isAdminEmail(session.user.email, session.user.emailVerified))
}
