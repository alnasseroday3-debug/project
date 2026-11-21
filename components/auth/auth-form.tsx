'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { ArrowLeft, CarFront, Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

type AuthFormProps = {
  mode: 'sign-in' | 'sign-up'
  redirectTo?: string
}

function isPhoneIdentifier(value: string) {
  return /^\+?[\d\s()-]{8,20}$/.test(value.trim()) && value.replace(/\D/g, '').length >= 8
}

function normalizePhone(value: string) {
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, '')
  return trimmed.startsWith('+') ? `+${digits}` : digits
}

export function AuthForm({ mode, redirectTo }: AuthFormProps) {
  const isSignUp = mode === 'sign-up'
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')

    try {
      if (isSignUp) {
        const email = identifier.trim().toLowerCase()
        const username = phone ? normalizePhone(phone) : undefined
        const result = await authClient.signUp.email({
          name: name.trim(),
          email,
          password,
          ...(username ? { username } : {}),
        })
        if (result.error) throw new Error('تعذّر إنشاء الحساب. تحقق من بياناتك وحاول مرة ثانية.')
        setNotice('تم إنشاء حسابك. رقم الهاتف المضاف يعمل كمعرّف للدخول مع كلمة المرور.')
      } else {
        const normalized = identifier.trim()
        const result = isPhoneIdentifier(normalized)
          ? await authClient.signIn.username({ username: normalizePhone(normalized), password })
          : await authClient.signIn.email({ email: normalized.toLowerCase(), password })
        if (result.error) throw new Error('تعذّر تسجيل الدخول. راجع البيانات وحاول مرة ثانية.')
      }

      const next = redirectTo?.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/'
      router.push(next)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر إكمال العملية. حاول مرة أخرى.')
    } finally {
      setBusy(false)
    }
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

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignUp && (
              <label className="form-field"><span>الاسم الكامل</span><span className="input-shell"><UserRound aria-hidden="true" /><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: نورة العتيبي" required minLength={2} maxLength={100} /></span></label>
            )}
            <label className="form-field"><span>{isSignUp ? 'البريد الإلكتروني' : 'البريد الإلكتروني أو رقم الهاتف'}</span><span className="input-shell">{!isSignUp && isPhoneIdentifier(identifier) ? <Phone aria-hidden="true" /> : <Mail aria-hidden="true" />}<input autoComplete={isSignUp ? 'email' : 'username'} type={isSignUp ? 'email' : 'text'} inputMode={isSignUp ? 'email' : 'text'} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={isSignUp ? 'name@example.com' : 'البريد أو +9665…'} required maxLength={160} /></span></label>
            {isSignUp && (
              <label className="form-field"><span>رقم الجوال <small>اختياري</small></span><span className="input-shell"><Phone aria-hidden="true" /><input autoComplete="tel" type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+966 5X XXX XXXX" pattern="\+?[0-9\s()-]{8,20}" /></span><small className="field-help">يمكنك استخدام الرقم كمعرّف للدخول مع كلمة المرور.</small></label>
            )}
            <label className="form-field"><span>كلمة المرور</span><span className="input-shell"><LockKeyhole aria-hidden="true" /><input autoComplete={isSignUp ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required minLength={8} maxLength={128} /><button className="password-toggle" type="button" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></span>{isSignUp && <small className="field-help">8 أحرف على الأقل.</small>}</label>
            {error && <p className="form-alert" role="alert">{error}</p>}
            {notice && <p className="form-success" role="status">{notice}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? 'لحظة واحدة…' : isSignUp ? 'إنشاء الحساب' : 'تسجيل الدخول'} <ArrowLeft aria-hidden="true" /></button>
          </form>

          <p className="auth-switch">{isSignUp ? 'عندك حساب؟' : 'ما عندك حساب؟'} <Link href={isSignUp ? '/sign-in' : '/sign-up'}>{isSignUp ? 'سجّل الدخول' : 'أنشئ حساباً'}</Link></p>
          <p className="auth-legal">بالمتابعة، أنت توافق على شروط الاستخدام وسياسة الخصوصية.</p>
        </div>
      </section>
    </main>
  )
}
