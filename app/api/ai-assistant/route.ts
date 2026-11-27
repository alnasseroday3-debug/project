import { desc, eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { carListings, user } from '@/lib/db/schema'
import { listingCategoryLabels, type ListingCategory } from '@/lib/listing-categories'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
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
    console.error('DB read warning in AI assistant:', dbErr)
  }

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

  try {
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
      const errDetail = await geminiResponse.text().catch(() => '')
      return NextResponse.json(
        { error: `خطأ من خدمة الذكاء الاصطناعي (${geminiResponse.status}): ${errDetail.slice(0, 120)}` },
        { status: 502 },
      )
    }

    const geminiData = (await geminiResponse.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const firstCandidate = geminiData.candidates?.at(0)
    const firstPart = firstCandidate?.content?.parts?.at(0)
    const reply = firstPart?.text?.trim() || 'أهلاً بك في مَسار! كيف يمكنني مساعدتك اليوم؟'

    return NextResponse.json({ reply })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'خطأ غير معروف'
    return NextResponse.json({ error: `تعذّر الاتصال بخدمة الذكاء الاصطناعي: ${msg}` }, { status: 500 })
  }
        }
        
