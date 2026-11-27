'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Bot, Send, Sparkles, X } from 'lucide-react'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

function renderMessageWithLinks(text: string) {
  const parts = text.split(/(\/(?:cars|people)\/[a-zA-Z0-9_-]+)/g)
  return parts.map((part, index) => {
    if (/^\/(?:cars|people)\/[a-zA-Z0-9_-]+$/.test(part)) {
      return (
        <Link
          key={index}
          href={part}
          style={{
            color: '#10B981',
            textDecoration: 'underline',
            fontWeight: 600,
            margin: '0 4px',
          }}
        >
          {part.startsWith('/cars/') ? 'عرض الإعلان ↗' : 'عرض البروفايل ↗'}
        </Link>
      )
    }
    return <span key={index}>{part}</span>
  })
}

export function AiChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'أهلاً بك في مساعد مَسار الذكي! اسألني عن أي إعلانات، أسعار، أو أعضاء داخل الموقع وسأجيبك فوراً من بيانات السوق الحية.',
    },
  ])
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, open, busy])

  async function handleSend(event: FormEvent) {
    event.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || busy) return

    const userMsg: ChatMessage = { id: String(Date.now()), role: 'user', text: trimmed }
    const nextHistory = [...messages, userMsg]
    setMessages(nextHistory)
    setInput('')
    setBusy(true)

    try {
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: nextHistory.slice(-6).map((m) => ({ role: m.role, text: m.text })),
        }),
      })
      const data = (await response.json().catch(() => ({}))) as { reply?: string; error?: string }
      const replyText = response.ok && data.reply ? data.reply : data.error || 'تعذّر الحصول على رد حالياً.'
      setMessages((prev) => [...prev, { id: String(Date.now() + 1), role: 'assistant', text: replyText }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 1), role: 'assistant', text: 'تعذّر الاتصال بالخادم. حاول مرة أخرى.' },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="مساعد مَسار الذكي"
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#10B981',
          color: '#062016',
          border: 'none',
          borderRadius: '999px',
          padding: '12px 18px',
          fontWeight: 700,
          fontSize: '14px',
          boxShadow: '0 10px 25px rgba(16, 185, 129, 0.35)',
          cursor: 'pointer',
        }}
      >
        {open ? <X size={20} /> : <Bot size={20} />}
        <span>{open ? 'إغلاق' : 'مساعد مَسار'}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="محادثة مساعد مَسار الذكي"
          style={{
            position: 'fixed',
            bottom: '76px',
            left: '20px',
            right: '20px',
            maxWidth: '390px',
            height: '470px',
            maxHeight: '72vh',
            zIndex: 60,
            backgroundColor: '#0f1715',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '18px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#13221e',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="#10B981" />
              <div>
                <strong style={{ display: 'block', fontSize: '14px', color: '#fff' }}>مساعد مَسار الذكي</strong>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>يجيب من بيانات وإعلانات الموقع فقط</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق النافذة"
              style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-start' : 'flex-end',
                  backgroundColor: msg.role === 'user' ? '#10B981' : '#1b2824',
                  color: msg.role === 'user' ? '#052016' : '#f3f4f6',
                  padding: '10px 14px',
                  borderRadius: '14px',
                  maxWidth: '86%',
                  fontSize: '13.5px',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.role === 'assistant' ? renderMessageWithLinks(msg.text) : msg.text}
              </div>
            ))}
            {busy && (
              <div
                style={{
                  alignSelf: 'flex-end',
                  backgroundColor: '#1b2824',
                  color: '#9ca3af',
                  padding: '8px 14px',
                  borderRadius: '14px',
                  fontSize: '13px',
                }}
              >
                جارٍ البحث في بيانات الموقع…
              </div>
            )}
          </div>

          <form
            onSubmit={handleSend}
            style={{
              padding: '10px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              gap: '8px',
              backgroundColor: '#0b1210',
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اسأل عن سعر، سيارة، أو شخص..."
              maxLength={600}
              style={{
                flex: 1,
                backgroundColor: '#16221f',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px',
                padding: '9px 12px',
                color: '#fff',
                fontSize: '13.5px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="إرسال"
              style={{
                backgroundColor: '#10B981',
                color: '#062016',
                border: 'none',
                borderRadius: '10px',
                padding: '0 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: busy || !input.trim() ? 0.5 : 1,
              }}
            >
              <Send size={17} />
            </button>
          </form>
        </div>
      )}
    </>
  )
        }
          
