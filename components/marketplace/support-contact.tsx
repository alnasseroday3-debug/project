'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'

type SupportCategory = 'technical_issue' | 'listing_question' | 'report_violation' | 'general_inquiry'
type CaptchaChallenge = { challengeId: string; question: string }
type SubmissionResult = { reference: string; whatsappUrl: string | null }

const categories: { value: SupportCategory; label: string }[] = [
  { value: 'technical_issue', label: 'مشكلة تقنية' },
  { value: 'listing_question', label: 'استفسار عن إعلان' },
  { value: 'report_violation', label: 'الإبلاغ عن مخالفة' },
  { value: 'general_inquiry', label: 'استفسار عام' },
]

export function SupportContact({ location }: { location: 'footer' | 'navigation' }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const formId = useId()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<SupportCategory>('general_inquiry')
  const [message, setMessage] = useState('')
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null)
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submission, setSubmission] = useState<SubmissionResult | null>(null)

  async function openSupportDialog() {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    setError('')
    setSubmission(null)
    setCaptchaAnswer('')
    setChallenge(null)
    setIsLoadingChallenge(true)

    try {
      const response = await fetch('/api/support', { cache: 'no-store' })
      const result: unknown = await response.json()
      if (!response.ok || !result || typeof result !== 'object' || !('challengeId' in result) || !('question' in result) || typeof result.challengeId !== 'string' || typeof result.question !== 'string') {
        throw new Error('تعذّر تحميل سؤال التحقق. حاول مرة أخرى.')
      }
      setChallenge({ challengeId: result.challengeId, question: result.question })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذّر تحميل سؤال التحقق.')
    } finally {
      setIsLoadingChallenge(false)
    }
  }

  function closeSupportDialog() {
    if (isSubmitting) return
    dialogRef.current?.close()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!challenge || isSubmitting) return

    const whatsappWindow = window.open('', '_blank')
    if (whatsappWindow) whatsappWindow.opener = null
    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, message, captchaAnswer, challengeId: challenge.challengeId }),
      })
      const result: unknown = await response.json()
      if (!response.ok || !result || typeof result !== 'object' || !('reference' in result) || typeof result.reference !== 'string' || !('whatsappUrl' in result) || (typeof result.whatsappUrl !== 'string' && result.whatsappUrl !== null)) {
        const serverMessage = result && typeof result === 'object' && 'message' in result && typeof result.message === 'string' ? result.message : 'تعذّر إرسال طلبك الآن.'
        throw new Error(serverMessage)
      }

      const success = { reference: result.reference, whatsappUrl: result.whatsappUrl }
      setSubmission(success)
      setChallenge(null)
      if (success.whatsappUrl && whatsappWindow) whatsappWindow.location.replace(success.whatsappUrl)
      else whatsappWindow?.close()
    } catch (requestError) {
      whatsappWindow?.close()
      setError(requestError instanceof Error ? requestError.message : 'تعذّر الاتصال بالخادم. حاول مرة أخرى.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        className={`support-launch support-launch--${location}`}
        type="button"
        aria-haspopup="dialog"
        onClick={openSupportDialog}
      >
        <img className="support-whatsapp-icon" src="/images/whatsapp.svg" alt="" aria-hidden="true" />
        <span>{location === 'footer' ? 'تواصل مع الدعم' : 'الدعم والتواصل'}</span>
      </button>

      <dialog ref={dialogRef} className="support-dialog" aria-labelledby={`${formId}-title`} onCancel={(event) => { if (isSubmitting) event.preventDefault() }} onClose={() => { setError(''); setChallenge(null); setCaptchaAnswer(''); setSubmission(null) }}>
        <div className="support-dialog-heading">
          <div><span className="support-dialog-kicker">فريق مَسَار هنا للمساعدة</span><h2 id={`${formId}-title`}>كيف نقدر نساعدك؟</h2><p>اكتب تفاصيل طلبك، وسنرسلها لفريق الدعم عبر واتساب.</p></div>
          <button className="support-dialog-close" type="button" onClick={closeSupportDialog} disabled={isSubmitting} aria-label="إغلاق نافذة الدعم"><X aria-hidden="true" /></button>
        </div>

        {submission ? (
          <section className="support-success" role="status">
            <span className="support-success-mark"><Send aria-hidden="true" /></span>
            <h3>تم استلام طلبك</h3>
            <p>احفظ رقم المرجع للمتابعة مع فريق مَسَار.</p>
            <strong className="support-reference" dir="ltr">{submission.reference}</strong>
            {submission.whatsappUrl ? <a className="support-submit" href={submission.whatsappUrl} target="_blank" rel="noopener noreferrer">فتح محادثة واتساب</a> : <p className="support-inline-note">تم حفظ الطلب، لكن تعذّر إعداد رابط واتساب. تواصل مع الدعم مع رقم المرجع أعلاه.</p>}
            <button className="support-cancel" type="button" onClick={closeSupportDialog}>إغلاق</button>
          </section>
        ) : (
          <form className="support-form" onSubmit={handleSubmit}>
            <label className="support-field" htmlFor={`${formId}-name`}>
              <span>الاسم</span>
              <input id={`${formId}-name`} name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} minLength={2} required disabled={isSubmitting} placeholder="الاسم الذي تود أن نناديك به" />
            </label>
            <label className="support-field" htmlFor={`${formId}-category`}>
              <span>نوع الطلب</span>
              <select id={`${formId}-category`} name="category" value={category} onChange={(event) => setCategory(event.target.value as SupportCategory)} required disabled={isSubmitting}>
                {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="support-field" htmlFor={`${formId}-message`}>
              <span>التفاصيل <small>{message.length}/500</small></span>
              <textarea id={`${formId}-message`} name="message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} minLength={10} rows={4} required disabled={isSubmitting} placeholder="اشرح لنا ما الذي تحتاج المساعدة فيه…" />
            </label>
            <label className="support-field" htmlFor={`${formId}-captcha`}>
              <span>{challenge?.question ?? (isLoadingChallenge ? 'جارٍ تحميل سؤال التحقق…' : 'أجب عن سؤال التحقق')}</span>
              <input id={`${formId}-captcha`} name="captcha" inputMode="numeric" autoComplete="off" pattern="[0-9٠-٩۰-۹]{1,2}" value={captchaAnswer} onChange={(event) => setCaptchaAnswer(event.target.value)} required disabled={isSubmitting || isLoadingChallenge || !challenge} placeholder="الإجابة بالأرقام" />
            </label>
            {error && <p className="support-error" role="alert">{error}</p>}
            <div className="support-dialog-actions">
              <button className="support-cancel" type="button" onClick={closeSupportDialog} disabled={isSubmitting}>إلغاء</button>
              <button className="support-submit" type="submit" disabled={isSubmitting || isLoadingChallenge || !challenge}>
                <MessageCircle aria-hidden="true" />{isSubmitting ? 'جارٍ إرسال الطلب…' : 'إرسال الطلب عبر واتساب'}
              </button>
            </div>
            <p className="support-privacy-note">سنستخدم بياناتك للرد على هذا الطلب فقط.</p>
          </form>
        )}
      </dialog>
    </>
  )
}
