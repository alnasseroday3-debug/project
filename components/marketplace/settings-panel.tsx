'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Check, Moon, Sun } from 'lucide-react'
import { isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone'
import { listingPreferencesStorageKey, syrianGovernorates, themePreferenceStorageKey, type ListingPreferences } from '@/lib/user-preferences'

type SettingsUser = { id: string; name: string; email: string; emailVerified: boolean; phoneNumber: string | null }
type Theme = 'dark' | 'light'

export function SettingsPanel({ user }: { user: SettingsUser }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [governorate, setGovernorate] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const preferencesKey = listingPreferencesStorageKey(user.id)

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(themePreferenceStorageKey)
      if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme)
      const savedPreferences = window.localStorage.getItem(preferencesKey)
      if (!savedPreferences) return
      const parsed = JSON.parse(savedPreferences) as Partial<ListingPreferences>
      if (typeof parsed.whatsappNumber === 'string') setWhatsappNumber(parsed.whatsappNumber)
      if (typeof parsed.governorate === 'string' && syrianGovernorates.includes(parsed.governorate as (typeof syrianGovernorates)[number])) {
        setGovernorate(parsed.governorate)
      }
    } catch {
      setError('تعذّر قراءة التفضيلات المحفوظة على هذا الجهاز.')
    }
  }, [preferencesKey])

  function toggleTheme() {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    document.documentElement.dataset.theme = nextTheme
    try {
      window.localStorage.setItem(themePreferenceStorageKey, nextTheme)
    } catch {
      setError('تم تغيير المظهر لهذه الجلسة، لكن تعذّر حفظه على هذا الجهاز.')
    }
  }

  function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    const normalizedNumber = normalizePhoneNumber(whatsappNumber)
    if (whatsappNumber.trim() && !isValidPhoneNumber(normalizedNumber)) {
      setError('أدخل رقم واتساب صحيحاً مع رمز الدولة أو بصيغته السورية المحلية.')
      return
    }

    const preferences: ListingPreferences = { whatsappNumber: normalizedNumber, governorate }
    try {
      window.localStorage.setItem(preferencesKey, JSON.stringify(preferences))
      setWhatsappNumber(normalizedNumber)
      setMessage('تم حفظ تفضيلات الإعلانات على هذا الجهاز.')
    } catch {
      setError('تعذّر حفظ التفضيلات. تحقق من إعدادات التخزين في المتصفح.')
    }
  }

  return (
    <div className="settings-content">
      <section className="settings-card settings-theme-card" aria-labelledby="settings-theme-title">
        <div className="settings-card-heading">
          <span className="settings-card-icon"><Sun aria-hidden="true" /></span>
          <div><h2 id="settings-theme-title">مظهر التطبيق</h2><p>اختر المظهر المناسب لك، ويتغير فوراً في كل الصفحات.</p></div>
        </div>
        <button className="theme-toggle" type="button" role="switch" aria-checked={theme === 'light'} onClick={toggleTheme}>
          <span>{theme === 'dark' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}{theme === 'dark' ? 'الوضع الداكن' : 'الوضع المضيء'}</span>
          <i aria-hidden="true"><b /></i>
        </button>
      </section>

      <section className="settings-card" aria-labelledby="settings-defaults-title">
        <div className="settings-card-heading">
          <span className="settings-card-icon"><Check aria-hidden="true" /></span>
          <div><h2 id="settings-defaults-title">تفضيلات الإعلان</h2><p>تُملأ هذه القيم تلقائياً عند بدء إعلان جديد، ويمكنك تعديلها قبل الإرسال.</p></div>
        </div>
        <form className="settings-preferences-form" onSubmit={savePreferences}>
          <label className="settings-field" htmlFor="settings-whatsapp"><span>رقم واتساب الافتراضي</span><input id="settings-whatsapp" type="tel" dir="ltr" inputMode="tel" autoComplete="tel" value={whatsappNumber} onChange={(event) => { setWhatsappNumber(event.target.value); setMessage('') }} placeholder="+963 9XX XXX XXX" maxLength={32} /></label>
          <label className="settings-field" htmlFor="settings-governorate"><span>المحافظة الافتراضية</span><select id="settings-governorate" value={governorate} onChange={(event) => { setGovernorate(event.target.value); setMessage('') }}><option value="">اختر المحافظة</option>{syrianGovernorates.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          {error && <p className="settings-feedback is-error" role="alert">{error}</p>}
          {message && <p className="settings-feedback" role="status">{message}</p>}
          <button className="settings-save-button" type="submit">حفظ التفضيلات</button>
          <p className="settings-storage-note">تُحفظ التفضيلات محلياً في هذا المتصفح ولا تُرسل إلى الخادم.</p>
        </form>
      </section>

      <section className="settings-card" aria-labelledby="settings-account-title">
        <div className="settings-card-heading">
          <span className="settings-card-icon settings-account-avatar" aria-hidden="true">{user.name.slice(0, 1)}</span>
          <div><h2 id="settings-account-title">بيانات الحساب</h2><p>معلومات الحساب المسجل حالياً.</p></div>
        </div>
        <dl className="settings-account-grid">
          <div><dt>الاسم</dt><dd>{user.name}</dd></div>
          <div><dt>البريد الإلكتروني</dt><dd dir="ltr">{user.email}</dd></div>
          <div><dt>رقم الهاتف</dt><dd dir="ltr">{user.phoneNumber || 'غير مضاف'}</dd></div>
        </dl>
      </section>

      <section className="settings-card settings-password-card" aria-labelledby="settings-password-title">
        <div className="settings-card-heading">
          <span className="settings-card-icon"><Moon aria-hidden="true" /></span>
          <div><h2 id="settings-password-title">تغيير كلمة المرور</h2><p>إدارة كلمة مرور حسابك.</p></div>
        </div>
        <p className="settings-password-note">تغيير كلمة المرور غير متاح حالياً: يتطلب نقطة آمنة في واجهة المصادقة الخلفية، ولم أضفها احتراماً لطلبك بعدم تعديل مسارات <code>/api/auth</code>.</p>
        <button className="settings-save-button" type="button" disabled>تغيير كلمة المرور</button>
      </section>
    </div>
  )
}
