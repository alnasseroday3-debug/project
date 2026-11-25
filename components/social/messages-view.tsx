'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { LockKeyhole, Mail, Send, UserRound } from 'lucide-react'
import { decryptMessage, encryptMessage, getOrCreateMessagingKeys, type LocalMessagingKeys } from '@/lib/social/crypto'

type Conversation = { id: string; updatedAt: string; other: { id: string; name: string; image: string | null; messagingPublicKey: string | null } }
type EncryptedMessage = { id: string; senderId: string; ciphertext: string; iv: string; wrappedKey: string; createdAt: string; text?: string }
type Thread = { other: Conversation['other']; messages: EncryptedMessage[] }
type UserSummary = { id: string; name: string; image: string | null; messagingPublicKey: string | null }

const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: 'same-origin' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'تعذّر تحميل المحادثات.')
  return body
}

export function MessagesView({ userId, targetId }: { userId: string; targetId: string }) {
  const requestedTargetId = targetId
  const [keys, setKeys] = useState<LocalMessagingKeys | null>(null)
  const [activeId, setActiveId] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { data: conversationData, isLoading: conversationsLoading, mutate: mutateConversations } = useSWR<{ conversations: Conversation[] }>('/api/social/conversations', fetcher, { refreshInterval: 20_000 })
  const threadKey = activeId ? `/api/social/conversations/${encodeURIComponent(activeId)}` : null
  const { data: threadData, isLoading: threadLoading, mutate: mutateThread } = useSWR<Thread>(threadKey, fetcher, { refreshInterval: 8_000, revalidateOnFocus: true })

  const ensureKeysReady = useCallback(async () => {
    const nextKeys = await getOrCreateMessagingKeys(userId)
    setKeys(nextKeys)
    void fetch('/api/social/keys', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publicKey: nextKeys.publicKey }) }).catch(() => {})
    return nextKeys
  }, [userId])

  useEffect(() => {
    let cancelled = false
    void ensureKeysReady().then((ready) => { if (!cancelled) setKeys(ready) }).catch(() => { if (!cancelled) setError('تعذّر تجهيز قناة الاتصال الآمنة.') })
    return () => { cancelled = true }
  }, [ensureKeysReady])

  const activeConversation = useMemo(() => conversationData?.conversations.find((item) => item.id === activeId), [conversationData, activeId])
  const activeOther = threadData?.other ?? activeConversation?.other

  const decryptedMessages = useMemo(() => {
    if (!keys || !threadData) return []
    return threadData.messages.map(async (item) => {
      try { return { ...item, text: await decryptMessage(item.ciphertext, item.iv, item.wrappedKey, keys.privateKey, activeId) } }
      catch { return { ...item, text: 'رسالة مشفّرة من جهاز آخر.' } }
    })
  }, [keys, threadData, activeId])

  const [messages, setMessages] = useState<EncryptedMessage[]>([])
  useEffect(() => {
    let cancelled = false
    void Promise.all(decryptedMessages).then((resolved) => { if (!cancelled) setMessages(resolved) })
    return () => { cancelled = true }
  }, [decryptedMessages])

  async function startConversation(target: UserSummary) {
    setBusy(true); setError('')
    try {
      await (keys ? Promise.resolve(keys) : ensureKeysReady())
      const response = await fetch('/api/social/conversations', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetId: target.id }) })
      const result = await response.json().catch(() => ({})) as { id?: string; error?: string }
      if (!response.ok || !result.id) throw new Error(result.error || 'تعذّر بدء المحادثة.')
      await mutateConversations(); setActiveId(result.id)
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذّر بدء المحادثة.') }
    finally { setBusy(false) }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeId || !activeOther || busy || !message.trim()) return
    const text = message.trim()
    if (text.length > 2000) { setError('الحد الأقصى للرسالة 2000 حرف.'); return }
    setBusy(true); setError('')
    try {
      const activeKeys = keys ?? await ensureKeysReady()
      const encrypted = await encryptMessage(text, activeKeys.publicKey, activeOther.messagingPublicKey ?? null, activeId)
      const response = await fetch(`/api/social/conversations/${encodeURIComponent(activeId)}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(encrypted) })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'تعذّر إرسال الرسالة.')
      setMessage(''); await Promise.all([mutateThread(), mutateConversations()])
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذّر إرسال الرسالة.') }
    finally { setBusy(false) }
  }

  const requestedConversation = requestedTargetId && !conversationData?.conversations.some((item) => item.other.id === requestedTargetId)
  const selectedConversation = conversationData?.conversations.find((item) => item.other.id === requestedTargetId)
  useEffect(() => { if (selectedConversation && !activeId) setActiveId(selectedConversation.id) }, [selectedConversation, activeId])

  return <section className="social-messages-shell" aria-label="الرسائل الخاصة">
    <aside className="social-conversation-panel"><div className="social-conversation-heading"><div><span className="eyebrow eyebrow-green">مراسلات خاصة</span><h2>المحادثات</h2></div><Mail aria-hidden="true" /></div>
      {conversationsLoading ? <p className="social-state" role="status">جارٍ تحميل المحادثات…</p> : conversationData?.conversations.length ? <ul className="social-conversation-list">{conversationData.conversations.map((c) => <li key={c.id}><button type="button" className={activeId === c.id ? 'social-conversation-item is-active' : 'social-conversation-item'} onClick={() => { setActiveId(c.id); setError('') }}><span className="social-avatar">{c.other.image ? <img src={c.other.image} alt="" /> : c.other.name.slice(0, 1)}</span><span><strong>{c.other.name}</strong><small>{new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium' }).format(new Date(c.updatedAt))}</small></span></button></li>)}</ul> : <p className="social-state"><Mail aria-hidden="true" />لا توجد محادثات بعد.</p>}
    </aside>
    <div className="social-thread-panel">{activeId && activeOther ? <><header className="social-thread-heading"><span className="social-avatar">{activeOther.image ? <img src={activeOther.image} alt="" /> : activeOther.name.slice(0, 1)}</span><div><strong>{activeOther.name}</strong><span><LockKeyhole aria-hidden="true" /> محادثة خاصة ومشفّرة تلقائياً</span></div></header>{error && <p className="social-inline-error" role="alert">{error}</p>}
      <div className="social-message-list" aria-live="polite">{threadLoading ? <p className="social-state" role="status">جارٍ تحميل الرسائل…</p> : messages.length ? messages.map((item) => <article className={item.senderId === userId ? 'social-message is-mine' : 'social-message'} key={item.id}><p>{item.text ?? 'جارٍ التحميل…'}</p><time>{new Intl.DateTimeFormat('ar-SY', { timeStyle: 'short' }).format(new Date(item.createdAt))}</time></article>) : <div className="social-empty"><LockKeyhole aria-hidden="true" /><strong>محادثة خاصة ومشفّرة</strong><span>لا يستطيع الخادم أو مدير الموقع قراءة نص الرسائل.</span></div>}</div>
      <form className="social-message-form" onSubmit={sendMessage}><label className="sr-only" htmlFor="private-message">اكتب رسالة نصية</label><textarea id="private-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} placeholder="اكتب رسالتك هنا…" required /><button type="submit" disabled={busy || !message.trim()} aria-label="إرسال الرسالة"><Send aria-hidden="true" /></button><span>نص فقط · مشفّر تلقائياً</span></form></> : requestedConversation ? <StartConversation targetId={requestedTargetId!} onStart={(t) => void startConversation(t)} busy={busy} error={error} /> : <div className="social-thread-empty"><LockKeyhole aria-hidden="true" /><h2>رسائل خاصة ومشفّرة</h2><p>اختر محادثة من القائمة أو ابدأ مراسلة أي بائع مباشرةً. التشفير يعمل تلقائياً في الخلفية لحماية خصوصيتك.</p>{error && <p className="social-inline-error" role="alert">{error}</p>}</div>}</div>
  </section>
}

function StartConversation({ targetId, onStart, busy, error }: { targetId: string; onStart: (target: UserSummary) => void; busy: boolean; error: string }) {
  const { data, isLoading } = useSWR<{ profile: UserSummary }>(`/api/social/profiles/${encodeURIComponent(targetId)}`, fetcher)
  const target = data?.profile
  return <div className="social-thread-empty">{isLoading ? <p className="social-state" role="status">جارٍ تحميل الحساب…</p> : target ? <><span className="social-avatar">{target.image ? <img src={target.image} alt="" /> : target.name.slice(0, 1) || <UserRound aria-hidden="true" />}</span><h2>ابدأ محادثة مع {target.name}</h2><p>رسائلك خاصة ومشفّرة تلقائياً بينك وبين {target.name} فقط.</p>{error && <p className="social-inline-error" role="alert">{error}</p>}<button type="button" className="social-message-link" onClick={() => onStart(target)} disabled={busy}><Send aria-hidden="true" /> ابدأ المحادثة الآن</button></> : <p className="social-inline-error" role="alert">تعذّر العثور على الحساب.</p>}</div>
                                }
             
