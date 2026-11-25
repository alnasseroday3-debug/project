const databaseName = 'masar-private-message-keys'
const storeName = 'account-keys'

export type LocalMessagingKeys = { publicKey: string; privateKey: CryptoKey }

function openKeyDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('تعذّر فتح مخزن مفاتيح التشفير.'))
  })
}

async function readKeys(userId: string): Promise<LocalMessagingKeys | null> {
  const database = await openKeyDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(userId)
    request.onsuccess = () => resolve((request.result as LocalMessagingKeys | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('تعذّر قراءة مفتاح التشفير.'))
    request.transaction?.addEventListener('complete', () => database.close(), { once: true })
  })
}

async function storeKeys(userId: string, keys: LocalMessagingKeys) {
  const database = await openKeyDatabase()
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(keys, userId)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('تعذّر حفظ مفتاح التشفير.')) }
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('تعذّر حفظ مفتاح التشفير.')) }
  })
}

function toBase64(value: ArrayBuffer) {
  const bytes = new Uint8Array(value)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

function fromBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function deriveSharedConversationKey(conversationId: string) {
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(`masar-e2ee:${conversationId}`), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('masar-syria-private-chat-v1'), iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function getOrCreateMessagingKeys(userId: string): Promise<LocalMessagingKeys> {
  const existing = await readKeys(userId)
  if (existing) return existing
  const generated = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']) as CryptoKeyPair
  const publicKey = toBase64(await crypto.subtle.exportKey('spki', generated.publicKey))
  const privateBytes = new Uint8Array(await crypto.subtle.exportKey('pkcs8', generated.privateKey))
  const privateKey = await crypto.subtle.importKey('pkcs8', privateBytes, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt'])
  privateBytes.fill(0)
  const keys = { publicKey, privateKey }
  await storeKeys(userId, keys)
  return keys
}

export async function loadMessagingKeys(userId: string) {
  return getOrCreateMessagingKeys(userId)
}

export async function encryptMessage(plaintext: string, senderPublicKey: string, recipientPublicKey: string | null, conversationId?: string) {
  const contentKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, contentKey, new TextEncoder().encode(plaintext))
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', contentKey))
  const sender = await crypto.subtle.importKey('spki', fromBase64(senderPublicKey), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
  const senderWrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, sender, rawKey)

  let recipientWrappedKeyStr = ''
  if (recipientPublicKey) {
    const recipient = await crypto.subtle.importKey('spki', fromBase64(recipientPublicKey), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
    const recipientWrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, recipient, rawKey)
    recipientWrappedKeyStr = toBase64(recipientWrappedKey)
  } else if (conversationId) {
    const sharedKey = await deriveSharedConversationKey(conversationId)
    const wrapIv = crypto.getRandomValues(new Uint8Array(12))
    const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wrapIv }, sharedKey, rawKey)
    recipientWrappedKeyStr = `shared:${toBase64(wrapIv.buffer)}:${toBase64(wrapped)}`
  }

  rawKey.fill(0)
  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv.buffer),
    senderWrappedKey: toBase64(senderWrappedKey),
    recipientWrappedKey: recipientWrappedKeyStr,
  }
}

export async function decryptMessage(ciphertext: string, iv: string, wrappedKey: string, privateKey: CryptoKey, conversationId?: string) {
  let rawKey: Uint8Array
  if (wrappedKey.startsWith('shared:') && conversationId) {
    const [, wrapIvB64, wrappedB64] = wrappedKey.split(':')
    const sharedKey = await deriveSharedConversationKey(conversationId)
    const decryptedRaw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(wrapIvB64) }, sharedKey, fromBase64(wrappedB64))
    rawKey = new Uint8Array(decryptedRaw)
  } else {
    rawKey = new Uint8Array(await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, fromBase64(wrappedKey)))
  }
  const contentKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt'])
  rawKey.fill(0)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, contentKey, fromBase64(ciphertext))
  return new TextDecoder().decode(plaintext)
}
  
