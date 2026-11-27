import { and, count, desc, eq, gt, sql } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { carListings, user, userFollows } from '@/lib/db/schema'
import { listingCategoryLabels } from '@/lib/listing-categories'

export const dynamic = 'force-dynamic'

const rateMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string) {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  if (entry.count >= 15) return true
  entry.count += 1
  return false
}

export async function POST(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  const ip = forwarded.split(',')[0]?.trim() || 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'تم إرسال عدد كبير من الأسئلة. يرجى الانتظار دقيقة.' }, { status: 429 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'مفتاح الذكاء الاصطناعي غير مفعّل بعد في إعدادات الخادم.' }, { status: 500 })
  }

  const body = (await request.json().catch(() => null)) as {
    message?: unknown
    history?: Array<{ role: 'user' | 'assistant'; text: string }>
  } | null

  const question = typeof body?.message === 'string' ? body.message.trim().slice(0, 600) : ''
  if (!question) {
    return NextResponse.json({ error: 'يرجى كتابة سؤالك أولاً.' }, { status: 400 })
  }

  try {
    const activeListings = await db
      .select({
        id: carListings.id,
        category: carListings.category,
        make: carListings.make,
        model: carListings.model,
        year: carListings.year,
        condition: carListings.condition,
        mileage: carListings.mileage,
        askingPrice: carListings.askingPrice,
        negotiable: carListings.negotiable,
        city: carListings.city,
        description: carListings.description,
        verified: carListings.verified,
        sellerName: user.name,
        sellerId: user.id,
      })
      .from(carListings)
      .leftJoin(user, eq(carListings.userId, user.id))
      .where(
        and(
          eq(carListings.status, 'approved'),
          gt(carListings.expiresAt, new Date()),
          eq(carListings.hiddenByOwner, false),
        ),
      )
      .orderBy(desc(carListings.publishedAt), desc(carListings.createdAt))
      .limit(80)

    const followersSubquery = db
      .select({
        followedId: userFollows.followedId,
        followersCount: count().as('followers_count'),
      })
      .from(userFollows)
      .groupBy(userFollows.followedId)
      .as('followers_sq')

    const platformUsers = await db
      .select({
        id: user.id,
        name: user.name,
        role: user.role,
        city: user.city,
        bio: user.bio,
        followersCount: sql<number>`COALESCE(${followersSubquery.followersCount}, 0)`,
      })
      .from(user)
      .leftJoin(followersSubquery, eq(user.id, followersSubquery.followedId))
      .orderBy(desc(sql`COALESCE(${followersSubquery.followersCount}, 0)`), desc(user.createdAt))
      .limit(50)

    const listingsContext =
      activeListings.length > 0
        ? activeListings
            .map((item) => {
              const catLabel = listingCategoryLabels[item.category] || item.category
              const title = item.category === 'cars' ? `${item.make} ${item.model} (${item.year})` : `${item.make} ${item.model}`.trim()
              return `- [${catLabel}] ${title} | السعر: $${item.askingPrice}${item.negotiable ? ' (قابل للتفاوض)' : ''} | المحافظة: ${item.city} | الحالة: ${item.condition === 'new' ? 'جديد' : 'مستعمل'} | البائع: ${item.sellerName || 'مستخدم'} | موثق: ${item.verified ? 'نعم' : 'لا'} | الوصف: ${(item.description || '').slice(0, 120)} | رابط الإعلان: /cars/${item.id}`
            })
            .join('\n')
        : 'لا توجد إعلانات منشورة في الموقع حالياً.'

    const usersContext =
      platformUsers.length > 0
        ? platformUsers
            .map(
              (person) =>
                `- الاسم: ${person.name} | الدور: ${person.role === 'admin' ? 'إدارة الموقع' : 'عضو'} | المدينة: ${person.city || 'غير محددة'} | عدد المتابعين: ${person.followersCount} | النبذة: ${(person.bio || 'لا توجد').slice(0, 100)} | رابط البروفايل: /people/${person.id}`,
            )
            .join('\n')
        : 'لا يوجد أعضاء مسجلون حالياً.'

    const systemInstruction = `أنت المساعد الذكي الرسمي لموقع "مَسار" (سوق سوريا الشامل).
قواعد صارمة لا يجوز مخالفتها أبداً:
1. أجب باللغة العربية بأسلوب ودود ومختصر وواضح.
2. اعتمد حصرياً وفقط على البيانات الحية المرفقة أدناه من قاعدة بيانات موقع "مَسار".
3. يُمنع منعاً باتاً تأليف أي أسعار أو إعلانات أو أسماء أشخاص غير موجودة في البيانات أدناه، ويُمنع الإجابة عن مواضيع عامة خارج نطاق موقع "مَسار".
4. إذا سألك المستخدم عن شيء غير موجود في البيانات الحالية، قل له بوضوح: "عذراً، لا تتوفر حالياً بيانات أو إعلانات مطابقة لهذا الطلب في موقع مَسار."
5. عند ذكر أي إعلان أو شخص مهم، اذكر تفاصيله بدقة وأرفق الرابط النسبي الخاص به (مثل /cars/... أو /people/...) ليتمكن المستخدم من زيارته مباشرة.

=== الإعلانات المنشورة حالياً في الموقع ===
${listingsContext}

=== الأعضاء والأشخاص في الموقع ===
${usersContext}`

    const recentHistory = Array.isArray(body?.history)
      ? body.history.slice(-6).map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(msg.text || '').slice(0, 600) }],
        }))
      : []

    const geminiResponse = await fetch(
      `https://googleapis.com{encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [...recentHistory, { role: 'user', parts: [{ text: question }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 700,
          },
        }),
      },
    )

    if (!geminiResponse.ok) {
      return NextResponse.json({ error: 'تعذّر الاتصال بخدمة الذكاء الاصطناعي حالياً.' }, { status: 502 })
    }

    const geminiData = (await geminiResponse.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const firstCandidate = geminiData.candidates?.[0]
    const firstPart = firstCandidate?.content?.parts?.[0]
    const reply =
      firstPart?.text?.trim() ||
      'عذراً، لم أتمكن من صياغة إجابة واضحة. حاول إعادة صياغة سؤالك.'

    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ أثناء تحليل البيانات.' }, { status: 500 })
  }
                                        }
