'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowUpLeft, CarFront, Menu, X } from 'lucide-react'
import { authClient, useSession } from '@/lib/auth-client'

export function SiteHeader() {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  async function handleSignOut() {
    await authClient.signOut()
    setMenuOpen(false)
    router.refresh()
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="wordmark" href="/" onClick={closeMenu} aria-label="مسار السيارات - الصفحة الرئيسية">
          <span className="wordmark-icon"><CarFront aria-hidden="true" /></span>
          <span>مَسَار<span className="wordmark-dot">.</span></span>
        </Link>

        <button
          className="mobile-menu-toggle"
          type="button"
          aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        <nav className={`site-nav${menuOpen ? ' is-open' : ''}`} aria-label="التنقل الرئيسي">
          <Link className={pathname === '/' ? 'nav-link is-active' : 'nav-link'} href="/" onClick={closeMenu}>اكتشف السيارات</Link>
          <Link className={pathname === '/sell' ? 'nav-link is-active' : 'nav-link'} href="/sell" onClick={closeMenu}>أضف إعلانك</Link>
          {session?.user && <Link className={pathname === '/my-listings' ? 'nav-link is-active' : 'nav-link'} href="/my-listings" onClick={closeMenu}>إعلاناتي</Link>}
          <Link className={pathname === '/admin' ? 'nav-link is-active' : 'nav-link'} href="/admin" onClick={closeMenu}>إدارة الإعلانات</Link>
          {session?.user ? (
            <div className="nav-account">
              <span className="nav-greeting">أهلًا، {session.user.name?.split(' ')[0] || 'بك'}</span>
              <button className="nav-signout" type="button" onClick={handleSignOut}>تسجيل الخروج</button>
            </div>
          ) : (
            <Link className="nav-login" href={`/sign-in?next=${encodeURIComponent(pathname || '/')}`} onClick={closeMenu}>
              دخول <ArrowUpLeft aria-hidden="true" />
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
