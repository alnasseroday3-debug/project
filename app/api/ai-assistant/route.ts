import { desc, eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { carListings, user } from '@/lib/db/schema'
import { listingCategoryLabels, type ListingCategory } from '@/lib/listing-categories'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'مفتاح GEMINI_API_KEY غير موجود في إعدادات Vercel.' }, { status: 500 })
  }

  const body = (await request.json().catch(() => null)) as {
    message?: unknown
    history?: Array<{ role: 'user' | 'assistant'; text: string }>
  } | null

  const question = typeof body?.message === 'string' ? body.message.trim().slice(0, 800) : ''
  if (!question) {
    return NextResponse.json({ error: 'يرجى كتابة رسالتك أولاً.' }, { status: 400 })
  }

  let listingsContext = 'لا توجد إعلانات منشورة حالياً.'
  let usersContext = 'لا يوجد أعضاء مسجلون حالياً.'

  try {
    const allListings = await db
      .select()
      .from(carListings)
      .where(eq(carListings.status, 'approved'))
      .orderBy(desc(carListings.createdAt))
      .limit(60)

    const visibleListings = allListings.filter((item) => !item.hiddenByOwner)
    if (visibleListings.length > 0) {
      listingsContext = visibleListings
        .map((item) => {
          const catKey = (item.category || 'cars') as ListingCategory
          const catLabel = listingCategoryLabels[catKey] || String(item.category || '')
          const title = item.category === 'cars' ? `${item.make} ${item.model} (${item.year})` : `${item.make} ${item.model}`.trim()
          return `- [${catLabel}] ${title} | السعر: $${item.askingPrice}${item.negotiable ? ' (قابل للتفاوض)' : ''} | المحافظة: ${item.city || 'غير محددة'} | الحالة: ${item.condition === 'new' ? 'جديد' : 'مستعمل'} | موثق: ${item.verified ? 'نعم' : 'لا'} | الوصف: ${(item.description || '').slice(0, 120)} | رابط الإعلان: /cars/${item.id}`
        })
        .join('\n')
    }

    const allUsers = await db
      .select({
        id: user.id,
        name: user.name,
        role: user.role,
        city: user.city,
        bio: user.bio,
      })
      .from(user)
      .limit(50)

    if (allUsers.length > 0) {
      usersContext = allUsers
        .map(
          (person) =>
            `- الاسم: ${person.name} | الصفة: ${person.role === 'admin' ? 'إدارة الموقع' : 'عضو'} | المدينة: ${person.city || 'غير محددة'} | النبذة: ${(person.bio || 'لا توجد').slice(0, 100)} | رابط البروفايل: /people/${person.id}`,
        )
        .join('\n')
    }
  } catch (dbErr) {
    console.error('DB read warning:', dbErr)
  }

  const systemInstruction = `أنت "مساعد مَسار"، المساعد الذكي لموقع "مَسار" (سوق سوريا الشامل للسيارات والعقارات والأثاث والأدوات الكهربائية والإلكترونيات والألبسة).
1. تفاعل بذكاء ولطف واحترام مع أي رسالة يكتبها المستخدم مهما كانت (تحية، نقطة، أو سؤال عام) تماماً مثل ChatGPT.
2. أجب عن الأسئلة العامة المتعلقة بالسوق والشراء والبيع والأسعار في سوريا والعالم من معرفتك الواسعة.
3. اعتمد في الإعلانات والأعضاء داخل موقع "مَسار" على البيانات الحية المرفقة أدناه، وأرفق الروابط النسبية (/cars/... أو /people/...) عند ذكر أي إعلان أو عضو داخل الموقع دون تأليف بيانات غير موجودة في الموقع.

=== الإعلانات المنشورة حالياً في موقع مَسار ===
${listingsContext}

=== الأعضاء والأشخاص في موقع مَسار ===
${usersContext}`

  const recentHistory = Array.isArray(body?.history)
    ? body.history.slice(-8).map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(msg.text || '').slice(0, 800) }],
      }))
    : []

  const host = ['generativelanguage', 'googleapis', 'com'].join('.')
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
  let lastError = ''

  for (const modelName of modelsToTry) {
    try {
      const targetUrl = 'https://' + host + '/v1beta/models/' + modelName + ':generateContent?key=' + encodeURIComponent(apiKey)
      const geminiResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [...recentHistory, { role: 'user', parts: [{ text: question }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 900 },
        }),
      })

      if (!geminiResponse.ok) {
        const errText = await geminiResponse.text().catch(() => '')
        lastError = modelName + ' (' + geminiResponse.status + '): ' + errText.slice(0, 120)
        continue
      }

      const geminiData = (await geminiResponse.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const parts = geminiData.candidates?.at(0)?.content?.parts || []
      const reply =
        parts.map((p) => p.text || '').join('').trim() ||
        'أهلاً بك في مَسار! كيف يمكنني مساعدتك اليوم؟'

      return NextResponse.json({ reply })
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'خطأ اتصال'
    }
  }

  return NextResponse.json(
    { error: 'تعذّر الحصول على رد: ' + lastError },
    { status: 502 },
  )
        }
      
