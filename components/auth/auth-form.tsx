'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { ArrowLeft, CarFront, Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react'
import { isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone'

type AuthFormProps = {
  mode: 'sign-in' | 'sign-up'
  redirectTo?: string
  variant?: 'page' | 'welcome'
  onAuthSuccess?: () => void
  onGuestBrowse?: () => void
}

type AuthResponse = {
  code?: string
  message?: string
  ok?: boolean
}

function isPhoneIdentifier(value: string) {
  const trimmed = value.trim()
  return /^[+\d٠-٩۰-۹\s()-]+$/.test(trimmed) && isValidPhoneNumber(normalizePhoneNumber(trimmed))
}

export function AuthForm({ mode, redirectTo, variant = 'page', onAuthSuccess, onGuestBrowse }: AuthFormProps) {
  const isSignUp = mode === 'sign-up'
  const isWelcome = variant === 'welcome'
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')

    try {
      const endpoint = isSignUp ? '/api/auth/sign-up' : '/api/auth/sign-in'
      const payload = isSignUp
        ? { name: name.trim(), email: identifier.trim().toLowerCase(), phoneNumber: phone.trim(), password }
        : { identifier: identifier.trim(), password }
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => ({})) as AuthResponse

      if (!response.ok) {
        setError(result.message || 'تعذّر إكمال العملية. حاول مرة أخرى.')
        return
      }

      onAuthSuccess?.()
      const next = redirectTo?.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/'
      router.replace(next)
      router.refresh()
    } catch {
      setError('تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت ثم حاول مجدداً.')
    } finally {
      setBusy(false)
    }
  }

  const form = (
    <form className={`auth-form${isWelcome ? ' guest-auth-form' : ''}`} onSubmit={handleSubmit}>
      {isSignUp && (
        <label className="form-field"><span>الاسم الكامل</span><span className="input-shell"><UserRound aria-hidden="true" /><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: نورة العتيبي" required minLength={2} maxLength={100} /></span></label>
      )}
      <label className="form-field"><span>{isSignUp ? 'البريد الإلكتروني' : 'البريد الإلكتروني أو رقم الهاتف'}</span><span className="input-shell">{!isSignUp && isPhoneIdentifier(identifier) ? <Phone aria-hidden="true" /> : <Mail aria-hidden="true" />}<input autoFocus={isWelcome} autoComplete={isSignUp ? 'email' : 'username'} type="text" inputMode={isSignUp ? 'email' : 'text'} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={isSignUp ? 'name@example.com' : 'البريد أو +963…'} required maxLength={254} /></span></label>
      {isSignUp && (
        <label className="form-field"><span>رقم الجوال <small>اختياري</small></span><span className="input-shell"><Phone aria-hidden="true" /><input autoComplete="tel" type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0992143399 أو +963 992 143 399" maxLength={32} /></span><small className="field-help">يمكنك تركه فارغاً أو استخدامه للدخول لاحقاً.</small></label>
      )}
      <label className="form-field"><span>كلمة المرور</span><span className="input-shell"><LockKeyhole aria-hidden="true" /><input autoComplete={isSignUp ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required minLength={8} maxLength={256} /><button className="password-toggle" type="button" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></span>{isSignUp && <small className="field-help">8 أحرف على الأقل، دون شروط إضافية.</small>}</label>
      {error && <p className="form-alert" role="alert">{error}</p>}
      <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? 'لحظة واحدة…' : isSignUp ? 'إنشاء الحساب' : isWelcome ? 'تسجيل دخول' : 'تسجيل الدخول'} <ArrowLeft aria-hidden="true" /></button>
    </form>
  )
  const accountSwitch = isWelcome
    ? <p className="auth-switch">ليس لديك حساب؟ <Link href="/sign-up">إنشاء حساب</Link></p>
    : <p className="auth-switch">{isSignUp ? 'عندك حساب؟' : 'ما عندك حساب؟'} <Link href={isSignUp ? '/sign-in' : '/sign-up'}>{isSignUp ? 'سجّل الدخول' : 'أنشئ حساباً'}</Link></p>

  if (isWelcome) {
    return (
      <section className="guest-auth-card" aria-labelledby="guest-auth-title">
        <Link className="guest-auth-wordmark" href="/" aria-label="مَسار، الصفحة الرئيسية">مَسار<span>.</span></Link>
        <span className="guest-auth-kicker">سوق سوريا الشامل</span>
        <h2 id="guest-auth-title">مرحباً بك في مَسار</h2>
        <p className="guest-auth-intro">اكتشف ما تبحث عنه، أو سجّل دخولك للبدء.</p>
        {form}
        {accountSwitch}
        <button className="guest-browse-button" type="button" onClick={onGuestBrowse}>تصفح السوق كزائر</button>
      </section>
    )
  }

  return (
    <main className="auth-page">
      <div className="auth-visual">
        <div className="auth-visual-overlay" />
        <div className="auth-visual-content">
          <Link className="wordmark auth-wordmark" href="/"><span className="wordmark-icon"><CarFront aria-hidden="true" /></span><span>مَسَار<span className="wordmark-dot">.</span></span></Link>
          <div><span className="eyebrow">اختيارك يبدأ هنا</span><h1>طريقٌ أوضح<br />إلى وجهتك.</h1><p>كل التفاصيل اللي تحتاجها، في مكان واحد.</p></div>
          <span className="auth-visual-footer">سوق السيارات، برؤية مختلفة.</span>
        </div>
      </div>
      <section className="auth-panel">
        <Link className="auth-back" href="/"><ArrowLeft aria-hidden="true" /> العودة للسوق</Link>
        <div className="auth-form-wrap">
          <span className="auth-kicker">{isSignUp ? 'مرحباً بك في مَسَار' : 'سعيدون بعودتك'}</span>
          <h2>{isSignUp ? 'أنشئ حسابك' : 'سجّل دخولك'}</h2>
          <p className="auth-intro">{isSignUp ? 'حساب واحد يكفي لتتابع كل خطوة.' : 'أدخل بياناتك للمتابعة إلى حسابك.'}</p>
          {form}
          {accountSwitch}
          <p className="auth-legal">بالمتابعة، أنت توافق على شروط الاستخدام وسياسة الخصوصية.</p>
        </div>
      </section>
    </main>
  )
}
