import Link from 'next/link'
import { AtSign, CarFront, MapPin } from 'lucide-react'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link className="wordmark footer-wordmark" href="/">
            <span className="wordmark-icon"><CarFront aria-hidden="true" /></span>
            <span>مَسَار<span className="wordmark-dot">.</span></span>
          </Link>
          <p>كل طريق يبدأ باختيارٍ صحيح. اكتشف سيارتك القادمة بثقة.</p>
        </div>
        <div className="footer-links">
          <span className="footer-title">استكشف</span>
          <Link href="/">السيارات المعروضة</Link>
          <Link href="/sell">أضف إعلانك</Link>
          <Link href="/admin">إدارة الإعلانات</Link>
        </div>
        <div className="footer-location">
          <span className="footer-title">من قلب المملكة</span>
          <span><MapPin aria-hidden="true" /> الرياض، السعودية</span>
          <span><AtSign aria-hidden="true" /> masar.cars</span>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 مَسَار. جميع الحقوق محفوظة.</span>
        <span>سوقٌ يقرّبك من سيارتك.</span>
      </div>
    </footer>
  )
}
