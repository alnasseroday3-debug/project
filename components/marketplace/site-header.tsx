'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowUpLeft, CarFront, Menu, X } from 'lucide-react'

type HeaderUser = { id: string; name: string; email: string; emailVerified: boolean; role: string; image: string | null }

export function SiteHeader({ isAdmin, pendingCount, myListingsCount, sessionUser }: { isAdmin: boolean; pendingCount: number; myListingsCount: number; sessionUser: HeaderUser | null }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  async function handleSignOut() {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
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
          {sessionUser && <Link className={pathname.startsWith('/my-listings') ? 'nav-link is-active nav-listings-link' : 'nav-link nav-listings-link'} href="/my-listings" aria-label={`إعلاناتي، ${myListingsCount} إعلانات`} onClick={closeMenu}><span>إعلاناتي</span><span className="nav-listings-badge" aria-hidden="true">{myListingsCount > 99 ? '99+' : myListingsCount}</span></Link>}
          {isAdmin && <Link className={pathname === '/admin' ? 'nav-link is-active nav-admin-link' : 'nav-link nav-admin-link'} href="/admin" onClick={closeMenu}>إدارة الإعلانات{pendingCount > 0 && <span className="nav-admin-badge" aria-label={`${pendingCount} طلبات بانتظار المراجعة`}>{pendingCount > 99 ? '99+' : pendingCount}</span>}</Link>}
          {sessionUser ? (
            <div className="nav-account">
              <span className="nav-greeting">أهلًا، {sessionUser.name?.split(' ')[0] || 'بك'}</span>
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
