'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ListChecks, Menu, Plus, Settings, ShieldCheck, X } from 'lucide-react'
import { SocialHeaderControls } from '@/components/social/header-controls'

type HeaderUser = { id: string; name: string; email: string; emailVerified: boolean; role: string; image: string | null }

export function SiteHeader({ isAdmin, pendingCount, myListingsCount, sessionUser }: { isAdmin: boolean; pendingCount: number; myListingsCount: number; sessionUser: HeaderUser | null }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!menuOpen) return
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

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

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <header ref={headerRef} className="site-header">
      <div className="site-header-inner">
        <Link className="wordmark" href="/" onClick={closeMenu} aria-label="مَسار - الصفحة الرئيسية">
          <span>مَسار<span className="wordmark-dot">.</span></span>
        </Link>
        <button
          ref={menuButtonRef}
          className="mobile-menu-toggle"
          type="button"
          aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          aria-expanded={menuOpen}
          aria-controls="site-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav id="site-navigation" className={`site-nav${menuOpen ? ' is-open' : ''}`} aria-label="التنقل الرئيسي">
          {isAdmin && <Link className={pathname === '/admin' ? 'nav-link is-active nav-admin-link' : 'nav-link nav-admin-link'} href="/admin" onClick={closeMenu}><ShieldCheck aria-hidden="true" /><span>إدارة الإعلانات</span>{pendingCount > 0 && <span className="nav-admin-badge" aria-label={`${pendingCount} طلبات بانتظار المراجعة`}>{pendingCount > 99 ? '99+' : pendingCount}</span>}</Link>}
          <Link className={pathname === '/sell' ? 'nav-link is-active nav-menu-sell' : 'nav-link nav-menu-sell'} href="/sell" onClick={closeMenu}><Plus aria-hidden="true" /><span>إضافة إعلان</span></Link>
          <Link className={pathname.startsWith('/my-listings') ? 'nav-link is-active nav-listings-link' : 'nav-link nav-listings-link'} href="/my-listings" onClick={closeMenu}><ListChecks aria-hidden="true" /><span>إعلاناتي</span>{sessionUser && <span className="nav-listings-badge" aria-label={`${myListingsCount} إعلانات`}>{myListingsCount > 99 ? '99+' : myListingsCount}</span>}</Link>
          <Link className={pathname === '/settings' ? 'nav-link is-active nav-settings-link' : 'nav-link nav-settings-link'} href="/settings" onClick={closeMenu}><Settings aria-hidden="true" /><span>الإعدادات</span></Link>
          <SocialHeaderControls sessionUser={sessionUser} />
          {sessionUser && <div className="nav-account"><span className="nav-greeting">أهلًا، {sessionUser.name?.split(' ')[0] || 'بك'}</span><button className="nav-signout" type="button" onClick={handleSignOut}>تسجيل الخروج</button></div>}
        </nav>
      </div>
    </header>
  )
}
