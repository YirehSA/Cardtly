import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/plan-server'
import { classifyAiError, reportAiFailure } from '@/lib/ai-failure'

// Reads a photo of a paper business card and returns structured
// contact data. Pro-only (each scan is a paid vision call). Reuses
// the same OPENAI_API_KEY as the AI bio writer.
//
// Body: { image: "data:image/jpeg;base64,..." }
// Returns: { contact: { name, title, company, email, phone, website, address } }

export const maxDuration = 30

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Pro gate - same plan check used across the dashboard.
  const plan = await getUserPlan(user.id)
  const isPro = plan.tier === 'pro' && plan.isActive
  if (!isPro) {
    return NextResponse.json({ error: 'Card scanning is a Pro feature.' }, { status: 403 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    // "Add OPENAI_API_KEY to enable it" was being shown to customers. That is
    // an instruction to us, in front of someone who cannot act on it.
    await reportAiFailure('not_configured', 'OPENAI_API_KEY is not set in the environment.', 'scan')
    return NextResponse.json(
      { error: 'Card scanning is temporarily unavailable. We have been alerted and are looking at it.' },
      { status: 503 }
    )
  }

  let body: { image?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const image = body.image
  if (!image || !image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }
  // Guard against oversized payloads (~8MB of base64).
  if (image.length > 8_000_000) {
    return NextResponse.json({ error: 'Image is too large. Try a smaller photo.' }, { status: 413 })
  }

  // Two phone fields, not one.
  //
  // This asked for "the primary phone number" and got exactly one back - on a
  // card carrying both a switchboard and a mobile, the model picked whichever
  // came first, usually the office line, and the mobile was thrown away. The
  // mobile is the number a salesperson actually wants.
  const prompt = [
    'You are reading a photo of a paper business card. Extract the contact details into JSON.',
    'Return ONLY a JSON object with these exact keys (use an empty string if a field is absent):',
    '{ "name": "", "title": "", "company": "", "email": "", "mobile": "", "office": "", "website": "", "address": "" }',
    'Rules:',
    '- name: the person\'s full name (not the company).',
    '- title: their job title / role.',
    '- mobile: the personal mobile or cell number. Cards label it Mobile, Cell, M, C, or Direct.',
    '- office: the landline, switchboard, work, or office number. Cards label it Tel, T, Office, Work, or Landline.',
    '- Read EVERY number on the card. A card often lists both; put each in the right field.',
    '- If only one number is present and it is not labelled, decide by format: a South African mobile starts 06, 07, 08 or +27 6/7/8; a landline starts 01-05 or +27 1-5. If still unclear, put it in mobile.',
    '- Never put the same number in both fields.',
    '- Keep numbers readable in the format printed on the card.',
    '- Ignore fax numbers entirely.',
    '- email: a single best email address.',
    '- website: the company or personal website, without "http://".',
    '- address: the full postal address on one line, if present.',
    '- If the card is unreadable or not a business card, return all empty strings.',
    'Do not invent data. Do not add commentary.',
  ].join('\n')

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image, detail: 'high' } },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content?.trim() || '{}'
    let parsed: Record<string, string>
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Could not read the card. Try a clearer photo.' }, { status: 422 })
    }

    const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
    const mobile = clean(parsed.mobile)
    // `phone` is still accepted so an older client, or a model that answers with
    // the previous single-field shape, does not come back empty.
    const office = clean(parsed.office)
    const legacy = clean(parsed.phone)

    const contact = {
      name:       clean(parsed.name),
      title:      clean(parsed.title),
      company:    clean(parsed.company),
      email:      clean(parsed.email),
      // phone is the mobile, matching the cards table where phone is the cell
      // and work_phone is the landline.
      phone:      mobile || legacy,
      work_phone: office && office !== (mobile || legacy) ? office : '',
      website:    clean(parsed.website),
      address:    clean(parsed.address),
    }

    // If nothing meaningful came back, tell the user rather than
    // handing them a blank form with no explanation.
    if (!contact.name && !contact.email && !contact.phone && !contact.work_phone && !contact.company) {
      return NextResponse.json({ error: 'No card details found. Make sure the whole card is in frame and well lit.' }, { status: 422 })
    }

    return NextResponse.json({ contact })
  } catch (err) {
    // The provider's own words never reach the customer. See lib/ai-failure.
    const failure = classifyAiError(err, 'scan')
    if (failure.ours) {
      await reportAiFailure(failure.kind, err instanceof Error ? err.message : String(err), 'scan')
    }
    return NextResponse.json({ error: failure.userMessage }, { status: failure.status })
  }
}
