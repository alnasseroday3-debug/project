'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { LockKeyhole, Mail, RefreshCw, Send, ShieldCheck, UserRound } from 'lucide-react'
import { decryptMessage, encryptMessage, getOrCreateMessagingKeys, loadMessagingKeys, type LocalMessagingKeys } from '@/lib/social/crypto'

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
  const [notice, setNotice] = useState('')
  const conversationsKey = '/api/social/conversations'
  const { data: conversationData, isLoading: conversationsLoading, mutate: mutateConversations } = useSWR<{ conversations: Conversation[] }>(conversationsKey, fetcher, { refreshInterval: 20_000 })
  const threadKey = activeId ? `/api/social/conversations/${encodeURIComponent(activeId)}` : null
  const { data: threadData, isLoading: threadLoading, mutate: mutateThread } = useSWR<Thread>(threadKey, fetcher, { refreshInterval: 8_000, revalidateOnFocus: true })

  useEffect(() => {
    let cancelled = false
    void loadMessagingKeys(userId).then((stored) => { if (!cancelled && stored) setKeys(stored) }).catch(() => setError('تعذّر فتح مفتاح التشفير على هذا الجهاز.'))
    return () => { cancelled = true }
  }, [userId])

  const activeConversation = useMemo(() => conversationData?.conversations.find((item) => item.id === activeId), [conversationData, activeId])
  const activeOther = threadData?.other ?? activeConversation?.other

  const decryptedMessages = useMemo(() => {
    if (!keys || !threadData) return []
    return threadData.messages.map(async (item) => {
      try { return { ...item, text: await decryptMessage(item.ciphertext, item.iv, item.wrappedKey, keys.privateKey) } }
      catch { return { ...item, text: 'تعذّر فك تشفير هذه الرسالة على هذا الجهاز.' } }
    })
  }, [keys, threadData])
  const [messages, setMessages] = useState<EncryptedMessage[]>([])
  useEffect(() => {
    let cancelled = false
    void Promise.all(decryptedMessages).then((resolved) => { if (!cancelled) setMessages(resolved) })
    return () => { cancelled = true }
  }, [decryptedMessages])

  const initializeKeys = useCallback(async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const nextKeys = await getOrCreateMessagingKeys(userId)
      const response = await fetch('/api/social/keys', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publicKey: nextKeys.publicKey }) })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'تعذّر تفعيل التشفير.')
      setKeys(nextKeys)
      setNotice('تم تفعيل تشفير هذا الجهاز. مفتاحك الخاص لا يغادر المتصفح.')
      await mutateConversations()
      return nextKeys
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذّر تفعيل التشفير.')
      return null
    } finally { setBusy(false) }
  }, [userId, mutateConversations])

  async function startConversation(target: UserSummary) {
    const activeKeys = keys ?? await initializeKeys()
    if (!activeKeys) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/social/conversations', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetId: target.id }) })
      const result = await response.json().catch(() => ({})) as { id?: string; error?: string }
      if (!response.ok || !result.id) throw new Error(result.error || 'تعذّر بدء المحادثة.')
      await mutateConversations()
      setActiveId(result.id)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذّر بدء المحادثة.')
    } finally { setBusy(false) }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!keys || !activeId || !activeOther?.messagingPublicKey || busy || !message.trim()) return
    const text = message.trim()
    if (text.length > 2000) { setError('الحد الأقصى للرسالة 2000 حرف.'); return }
    setBusy(true)
    setError('')
    try {
      const encrypted = await encryptMessage(text, keys.publicKey, activeOther.messagingPublicKey)
      const response = await fetch(`/api/social/conversations/${encodeURIComponent(activeId)}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(encrypted) })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'تعذّر إرسال الرسالة.')
      setMessage('')
      await Promise.all([mutateThread(), mutateConversations()])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذّر إرسال الرسالة.')
    } finally { setBusy(false) }
  }

  const requestedConversation = requestedTargetId && !conversationData?.conversations.some((item) => item.other.id === requestedTargetId)
  const selectedConversation = conversationData?.conversations.find((item) => item.other.id === requestedTargetId)
  useEffect(() => { if (selectedConversation && !activeId) setActiveId(selectedConversation.id) }, [selectedConversation, activeId])

  return <section className="social-messages-shell" aria-label="الرسائل الخاصة">
    <aside className="social-conversation-panel"><div className="social-conversation-heading"><div><span className="eyebrow eyebrow-green">مراسلات خاصة</span><h2>المحادثات</h2></div><Mail aria-hidden="true" /></div>
      {conversationsLoading ? <p className="social-state" role="status">جارٍ تحميل المحادثات…</p> : conversationData?.conversations.length ? <ul className="social-conversation-list">{conversationData.conversations.map((conversation) => <li key={conversation.id}><button type="button" className={activeId === conversation.id ? 'social-conversation-item is-active' : 'social-conversation-item'} onClick={() => { setActiveId(conversation.id); setError('') }}><span className="social-avatar">{conversation.other.image ? <img src={conversation.other.image} alt="" /> : conversation.other.name.slice(0, 1)}</span><span><strong>{conversation.other.name}</strong><small>{new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium' }).format(new Date(conversation.updatedAt))}</small></span></button></li>)}</ul> : <p className="social-state"><Mail aria-hidden="true" />لا توجد محادثات بعد.</p>}
      <button className="social-enable-crypto" type="button" onClick={() => void initializeKeys()} disabled={busy || Boolean(keys)}><ShieldCheck aria-hidden="true" />{keys ? 'التشفير مفعّل' : 'تفعيل التشفير على هذا الجهاز'}</button>
    </aside>
    <div className="social-thread-panel">{activeId && activeOther ? <><header className="social-thread-heading"><span className="social-avatar">{activeOther.image ? <img src={activeOther.image} alt="" /> : activeOther.name.slice(0, 1)}</span><div><strong>{activeOther.name}</strong><span><LockKeyhole aria-hidden="true" /> رسائل مشفّرة بين الطرفين فقط</span></div></header>{error && <p className="social-inline-error" role="alert">{error}</p>}{notice && <p className="social-inline-success" role="status">{notice}</p>}
      <div className="social-message-list" aria-live="polite">{threadLoading ? <p className="social-state" role="status">جارٍ تحميل الرسائل…</p> : messages.length ? messages.map((item) => <article className={item.senderId === userId ? 'social-message is-mine' : 'social-message'} key={item.id}><p>{item.text ?? 'جارٍ فك التشفير…'}</p><time>{new Intl.DateTimeFormat('ar-SY', { timeStyle: 'short' }).format(new Date(item.createdAt))}</time></article>) : <div className="social-empty"><LockKeyhole aria-hidden="true" /><strong>محادثة خاصة ومشفّرة</strong><span>لا يستطيع الخادم أو مدير الموقع قراءة نص الرسائل.</span></div>}</div>
      {keys && activeOther.messagingPublicKey ? <form className="social-message-form" onSubmit={sendMessage}><label className="sr-only" htmlFor="private-message">اكتب رسالة نصية</label><textarea id="private-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} placeholder="اكتب رسالة نصية…" required /><button type="submit" disabled={busy || !message.trim()} aria-label="إرسال الرسالة"><Send aria-hidden="true" /></button><span>نص فقط · بلا صور أو ملفات</span></form> : <div className="social-crypto-notice"><LockKeyhole aria-hidden="true" /><p>فعّل التشفير على هذا الجهاز للقراءة والإرسال. إذا فقدت هذا الجهاز أو بيانات المتصفح، لا يمكن استعادة مفتاحك الخاص.</p><button type="button" className="social-message-link" onClick={() => void initializeKeys()} disabled={busy}><RefreshCw aria-hidden="true" /> تفعيل التشفير</button></div>}</> : requestedConversation ? <StartConversation targetId={requestedTargetId!} onStart={(target) => void startConversation(target)} busy={busy} error={error} /> : <div className="social-thread-empty"><LockKeyhole aria-hidden="true" /><h2>رسائل خاصة ومشفّرة</h2><p>أرسل رسائل نصية فقط. يتم التشفير في متصفحك باستخدام AES-256-GCM، ولا يُحفظ مفتاح فك التشفير على الخادم.</p>{error && <p className="social-inline-error" role="alert">{error}</p>}<button type="button" className="social-message-link" onClick={() => void initializeKeys()} disabled={busy || Boolean(keys)}><ShieldCheck aria-hidden="true" />{keys ? 'التشفير مفعّل على هذا الجهاز' : 'تفعيل التشفير على هذا الجهاز'}</button></div>}</div>
  </section>
}

function StartConversation({ targetId, onStart, busy, error }: { targetId: string; onStart: (target: UserSummary) => void; busy: boolean; error: string }) {
  const { data, isLoading } = useSWR<{ profile: UserSummary }>(`/api/social/profiles/${encodeURIComponent(targetId)}`, fetcher)
  const target = data?.profile
  return <div className="social-thread-empty">{isLoading ? <p className="social-state" role="status">جارٍ تحميل الحساب…</p> : target ? <><span className="social-avatar">{target.image ? <img src={target.image} alt="" /> : target.name.slice(0, 1) || <UserRound aria-hidden="true" />}</span><h2>ابدأ محادثة مع {target.name}</h2><p>لن تُرسل الرسالة إلا بعد تفعيل التشفير لدى الطرفين.</p>{error && <p className="social-inline-error" role="alert">{error}</p>}<button type="button" className="social-message-link" onClick={() => onStart(target)} disabled={busy || !target.messagingPublicKey}><LockKeyhole aria-hidden="true" />{target.messagingPublicKey ? 'بدء محادثة مشفّرة' : 'المستخدم لم يفعّل التشفير بعد'}</button></> : <p className="social-inline-error" role="alert">تعذّر العثور على الحساب.</p>}</div>
}
