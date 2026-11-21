'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CalendarClock, MessageCircle, Trash2 } from 'lucide-react'
import type { AdminSupportTicket, SupportCategory } from '@/lib/db/schema'

const categoryLabels: Record<SupportCategory, string> = {
  technical_issue: 'مشكلة تقنية',
  listing_question: 'استفسار عن إعلان',
  report_violation: 'الإبلاغ عن مخالفة',
  general_inquiry: 'استفسار عام',
}

const ticketDate = new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium', timeStyle: 'short' })

export function SupportInbox({ tickets }: { tickets: AdminSupportTicket[] }) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')

  async function deleteTicket(ticket: AdminSupportTicket) {
    if (deletingId !== null || !window.confirm(`هل تريد حذف طلب الدعم ${ticket.reference} نهائياً؟`)) return
    setDeletingId(ticket.id)
    setFeedback('')
    try {
      const response = await fetch('/api/admin/support', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticket.id }),
      })
      const result: unknown = await response.json()
      const message = result && typeof result === 'object' && 'message' in result && typeof result.message === 'string' ? result.message : 'تعذّر حذف الطلب.'
      setFeedback(message)
      if (response.ok) router.refresh()
    } catch {
      setFeedback('تعذّر الاتصال بالخادم. حاول مرة أخرى.')
    } finally {
      setDeletingId(null)
    }
  }

  if (tickets.length === 0) {
    return <section className="admin-empty"><span><MessageCircle aria-hidden="true" /></span><h2>لا توجد طلبات دعم</h2><p>ستظهر هنا الرسائل التي يرسلها زوار مَسَار.</p></section>
  }

  return (
    <section className="support-inbox" aria-label="طلبات الدعم الواردة">
      {feedback && <p className="form-success admin-feedback" role="status">{feedback}</p>}
      <div className="support-ticket-list">
        {tickets.map((ticket) => (
          <article className="support-ticket-card" key={ticket.id}>
            <header className="support-ticket-header">
              <div><span className="support-ticket-reference" dir="ltr">{ticket.reference}</span><span className="support-ticket-category">{categoryLabels[ticket.category]}</span></div>
              <time className="support-ticket-date" dateTime={ticket.createdAt.toISOString()}><CalendarClock aria-hidden="true" />{ticketDate.format(ticket.createdAt)}</time>
            </header>
            <h2>{ticket.fullName}</h2>
            <p className="support-ticket-message">{ticket.message}</p>
            <footer className="support-ticket-actions">
              <span>رقم الطلب <strong dir="ltr">{ticket.reference}</strong></span>
              <button className="admin-permanent-delete" type="button" disabled={deletingId !== null} onClick={() => deleteTicket(ticket)}>
                <Trash2 aria-hidden="true" />{deletingId === ticket.id ? 'جارٍ الحذف…' : 'حذف الطلب'}
              </button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  )
}
