'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { LockKeyhole, Mail, Send } from 'lucide-react'

type Conversation = { id: string; updatedAt: string; other: { id: string; name: string; image: string | null } }
type Message = { id: string; senderId: string; createdAt: string; text: string }
type Thread = { other: Conversation['other']; messages: Message[] }

const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: 'same-origin' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'تعذّر تحميل المحادثات.')
  return body
}

export function MessagesView({ userId, initialConversationId }: { userId: string; initialConversationId: string }) {
  const [activeId, setActiveId] = useState(initialConversationId)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { data: conversationData, isLoading: conversationsLoading, mutate: mutateConversations } = useSWR<{ conversations: Conversation[] }>(
    '/api/social/conversations',
    fetcher,
    { refreshInterval: 20_000 },
  )
  const threadKey = activeId ? `/api/social/conversations/${encodeURIComponent(activeId)}` : null
  const { data: threadData, isLoading: threadLoading, mutate: mutateThread } = useSWR<Thread>(threadKey, fetcher, {
    refreshInterval: 8_000,
    revalidateOnFocus: true,
  })

  useEffect(() => {
    if (initialConversationId) setActiveId(initialConversationId)
  }, [initialConversationId])

  const activeConversation = useMemo(
    () => conversationData?.conversations.find((item) => item.id === activeId),
    [conversationData, activeId],
  )
  const activeOther = threadData?.other ?? activeConversation?.other
  const messages = threadData?.messages ?? []

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeId || busy || !message.trim()) return
    const text = message.trim()
    if (text.length > 2000) {
      setError('الحد الأقصى للرسالة 2000 حرف.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/social/conversations/${encodeURIComponent(activeId)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const result = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'تعذّر إرسال الرسالة.')
      setMessage('')
      await Promise.all([mutateThread(), mutateConversations()])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذّر إرسال الرسالة.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="social-messages-shell" aria-label="الرسائل الخاصة">
      <aside className="social-conversation-panel">
        <div className="social-conversation-heading">
          <div>
            <span className="eyebrow eyebrow-green">مراسلات خاصة</span>
            <h2>المحادثات</h2>
          </div>
          <Mail aria-hidden="true" />
        </div>
        {conversationsLoading ? (
          <p className="social-state" role="status">
            جارٍ تحميل المحادثات…
          </p>
        ) : conversationData?.conversations.length ? (
          <ul className="social-conversation-list">
            {conversationData.conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  className={activeId === conversation.id ? 'social-conversation-item is-active' : 'social-conversation-item'}
                  onClick={() => {
                    setActiveId(conversation.id)
                    setError('')
                  }}
                >
                  <span className="social-avatar">
                    {conversation.other.image ? <img src={conversation.other.image} alt="" /> : conversation.other.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{conversation.other.name}</strong>
                    <small>{new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium' }).format(new Date(conversation.updatedAt))}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="social-state">
            <Mail aria-hidden="true" />
            لا توجد محادثات بعد.
          </p>
        )}
      </aside>
      <div className="social-thread-panel">
        {activeId ? (
          activeOther ? (
            <>
              <header className="social-thread-heading">
                <span className="social-avatar">
                  {activeOther.image ? <img src={activeOther.image} alt="" /> : activeOther.name.slice(0, 1)}
                </span>
                <div>
                  <strong>{activeOther.name}</strong>
                  <span>
                    <LockKeyhole aria-hidden="true" /> تشفير AES‑256 تلقائي أثناء التخزين
                  </span>
                </div>
              </header>
              {error && (
                <p className="social-inline-error" role="alert">
                  {error}
                </p>
              )}
              <div className="social-message-list" aria-live="polite">
                {threadLoading ? (
                  <p className="social-state" role="status">
                    جارٍ تحميل الرسائل…
                  </p>
                ) : messages.length ? (
                  messages.map((item) => (
                    <article className={item.senderId === userId ? 'social-message is-mine' : 'social-message'} key={item.id}>
                      <p>{item.text}</p>
                      <time>{new Intl.DateTimeFormat('ar-SY', { timeStyle: 'short' }).format(new Date(item.createdAt))}</time>
                    </article>
                  ))
                ) : (
                  <div className="social-empty">
                    <LockKeyhole aria-hidden="true" />
                    <strong>ابدأ المحادثة الآن</strong>
                    <span>اكتب رسالتك في الأسفل للتواصل المباشر.</span>
                  </div>
                )}
              </div>
              <form className="social-message-form" onSubmit={sendMessage}>
                <label className="sr-only" htmlFor="private-message">
                  اكتب رسالة نصية
                </label>
                <textarea
                  id="private-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={2000}
                  placeholder="اكتب رسالة نصية…"
                  required
                />
                <button type="submit" disabled={busy || !message.trim()} aria-label="إرسال الرسالة">
                  <Send aria-hidden="true" />
                </button>
                <span>نص فقط · بلا صور أو ملفات</span>
              </form>
            </>
          ) : (
            <div className="social-thread-empty">
              <p className="social-state" role="status">
                جارٍ فتح المحادثة…
              </p>
            </div>
          )
        ) : (
          <div className="social-thread-empty">
            <LockKeyhole aria-hidden="true" />
            <h2>رسائل خاصة</h2>
            <p>اختر محادثة من القائمة أو اضغط على زر المراسلة في أي إعلان لبدء الدردشة فوراً.</p>
            {error && (
              <p className="social-inline-error" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
            }
