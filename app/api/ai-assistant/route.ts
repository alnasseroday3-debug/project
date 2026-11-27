import { and, desc, eq, gt, isNull, or } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { carListings, user } from '@/lib/db/schema'
import { listingCategoryLabels, type ListingCategory } from '@/lib/listing-categories'

export const dynamic = 'force-dynamic'

const rateMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string) {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  if (entry.count >= 25) return true
  entry.count += 1
  return false
}

export async function POST(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for') ?? ''
  const ip = forwarded.split(',').at(0)?.trim() || 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'تم إرسال عدد كبير من الأسئلة. يرجى الانتظار دقيقة.' }, { status: 429 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'مفتاح الذكاء الاصطناعي غير مفعّل في إعدادات Vercel.' }, { status: 500 })
  }

  const body = (await request.json().catch(() => null)) as {
    message?: unknown
    history?: Array<{ role: 'user' | 'assistant'; text: string }>
  } | null

  const question = typeof body?.message === 'string' ? body.message.trim().slice(0, 800) : ''
  if (!question) {
    return NextResponse.json({ error: 'يرجى كتابة رسالتك أولاً.' }, { status: 400 })
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
      })
      .from(carListings)
      .leftJoin(user, eq(carListings.userId, user.id))
      .where(
        and(
          eq(carListings.status, 'approved'),
          eq(carListings.hiddenByOwner, false),
          or(isNull(carListings.expiresAt), gt(carListings.expiresAt, new Date())),
        ),
      )
      .orderBy(desc(carListings.createdAt))
      .limit(80)

    const platformUsers = await db
      .select({
        id: user.id,
        name: user.name,
        role: user.role,
        city: user.city,
        bio: user.bio,
      })
      .from(user)
      .orderBy(desc(user.createdAt))
      .limit(50)

    const listingsContext =
      activeListings.length > 0
        ? activeListings
            .map((item) => {
              const catKey = (item.category || 'cars') as ListingCategory
              const catLabel = listingCategoryLabels[catKey] || item.category
              const title = item.category === 'cars' ? `${item.make} ${item.model} (${item.year})` : `${item.make} ${item.model}`.trim()
              return `- [${catLabel}] ${title} | السعر: $${item.askingPrice}${item.negotiable ? ' (قابل للتفاوض)' : ''} | المحافظة: ${item.city || 'غير محددة'} | الحالة: ${item.condition === 'new' ? 'جديد' : 'مستعمل'} | البائع: ${item.sellerName || 'مستخدم'} | موثق: ${item.verified ? 'نعم' : 'لا'} | الوصف: ${(item.description || '').slice(0, 120)} | رابط الإعلان: /cars/${item.id}`
            })
            .join('\n')
        : 'لا توجد إعلانات منشورة في الموقع حالياً.'

    const usersContext =
      platformUsers.length > 0
        ? platformUsers
            .map(
              (person) =>
                `- الاسم: ${person.name} | الصفة: ${person.role === 'admin' ? 'إدارة الموقع' : 'عضو'} | المدينة: ${person.city || 'غير محددة'} | النبذة: ${(person.bio || 'لا توجد').slice(0, 100)} | رابط البروفايل: /people/${person.id}`,
            )
            .join('\n')
        : 'لا يوجد أعضاء مسجلون حالياً.'

    const systemInstruction = `أنت "مساعد مَسار"، المساعد الذكي لموقع "مَسار" (سوق سوريا الشامل للسيارات والعقارات والأثاث والأدوات الكهربائية والإلكترونيات والألبسة).

شخصيتك وطريقة ردك:
1. كن ذكياً، طبيعياً، وسريع البديهة مثل ChatGPT؛ تفاعل مع أي رسالة يرسلها المستخدم مهما كانت قصيرة أو رمزية:
   - إذا أرسل تحية (مثل: مرحبا، السلام عليكم، هلا) أو نقطة (.) أو حرفاً واحداً، رد عليه بترحيب دافئ وعرّفه بنفسك باختصار واسأله كيف يمكنك مساعدته في السوق.
2. لديك مصدران للمعرفة:
   - **الأول (الأولوية القصوى):** البيانات الحية لقاعدة بيانات موقع "مَسار" المرفقة أدناه (الإعلانات المعتمدة، الأسعار، المحافظات، والأعضاء). لا تؤلف أبداً إعلانات أو أسماء أعضاء غير موجودة في القائمة أدناه. وعندما تذكر إعلاناً أو عضواً من القائمة، أرفق رابطه النسبي (/cars/... أو /people/...).
   - **الثاني (معرفتك العامة بالسوق):** إذا سأل المستخدم عن معلومات عامة تخص الشراء والبيع، أو مواصفات سيارة/جهاز، أو نصائح فحص قبل الشراء، أو مقارنة أسعار السوق في سوريا، أجب عليه بذكاء وخبرة من معرفتك العامة، ووضّح له ما إذا كان يتوفر شبيه له حالياً في إعلانات موقع "مَسار".
3. حافظ دائماً على ارتباط المحادثة بمجال موقع "مَسار" والسوق والتجارة؛ وإذا طلب المستخدم شيئاً بعيداً تماماً عن الموقع والسوق (مثل كتابة شعر أو حل مسائل رياضية)، اعتذر بلطف ووجّهه لما يمكنك مساعدته به داخل "مَسار".

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

    const geminiResponse = await fetch(
      `https://googleapis.com{encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [...recentHistory, { role: 'user', parts: [{ text: question }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 800,
          },
        }),
      },
    )

    if (!geminiResponse.ok) {
      return NextResponse.json({ error: `تعذّر الاتصال بخدمة الذكاء الاصطناعي (${geminiResponse.status}).` }, { status: 502 })
    }

    const geminiData = (await geminiResponse.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const firstCandidate = geminiData.candidates?.at(0)
    const firstPart = firstCandidate?.content?.parts?.at(0)
    const reply =
      firstPart?.text?.trim() ||
      'أهلاً بك في مَسار! كيف يمكنني مساعدتك اليوم؟'

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('AI Assistant error:', err)
    return NextResponse.json({ error: 'حدث خطأ أثناء معالجة رسالتك.' }, { status: 500 })
  }
        }
  
