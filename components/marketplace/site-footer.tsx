import Link from 'next/link'
import { AtSign, Store } from 'lucide-react'
import { PwaInstallButton } from '@/components/marketplace/pwa-install-button'
import { SupportContact } from '@/components/marketplace/support-contact'

export function SiteFooter({ isAdmin }: { isAdmin: boolean }) {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link className="wordmark footer-wordmark" href="/">
            <span className="wordmark-icon"><Store aria-hidden="true" /></span>
            <span>مَسَار<span className="wordmark-dot">.</span></span>
          </Link>
          <p>كل خيار يبدأ بتفاصيل واضحة. اكتشف ما تحتاجه في سوق سوريا الشامل.</p>
          <PwaInstallButton />
        </div>
        <div className="footer-links">
          <span className="footer-title">استكشف</span>
          <Link href="/">تصفّح السوق</Link>
          <Link href="/sell">أضف إعلانك</Link>
          {isAdmin && <Link href="/admin">إدارة الإعلانات</Link>}
        </div>
        <div className="footer-location">
          <span className="footer-title">منصتك الموثوقة</span>
          <span>سوق محلي لبيع وشراء احتياجاتك بكل شفافية</span>
          <span><AtSign aria-hidden="true" /> masar.sy</span>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 مَسَار. جميع الحقوق محفوظة.</span>
        <span>سوقٌ يقرّبك مما تبحث عنه.</span>
      </div>
      <div className="footer-support-row"><SupportContact /></div>
    </footer>
  )
}
