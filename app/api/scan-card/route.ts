import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/plan-server'

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
    return NextResponse.json(
      { error: 'Scanning is not configured. Add OPENAI_API_KEY to enable it.' },
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

  const prompt = [
    'You are reading a photo of a paper business card. Extract the contact details into JSON.',
    'Return ONLY a JSON object with these exact keys (use an empty string if a field is absent):',
    '{ "name": "", "title": "", "company": "", "email": "", "phone": "", "website": "", "address": "" }',
    'Rules:',
    '- name: the person\'s full name (not the company).',
    '- title: their job title / role.',
    '- phone: the primary phone number, digits and + only kept readable (keep the format on the card).',
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
    const contact = {
      name:    clean(parsed.name),
      title:   clean(parsed.title),
      company: clean(parsed.company),
      email:   clean(parsed.email),
      phone:   clean(parsed.phone),
      website: clean(parsed.website),
      address: clean(parsed.address),
    }

    // If nothing meaningful came back, tell the user rather than
    // handing them a blank form with no explanation.
    if (!contact.name && !contact.email && !contact.phone && !contact.company) {
      return NextResponse.json({ error: 'No card details found. Make sure the whole card is in frame and well lit.' }, { status: 422 })
    }

    return NextResponse.json({ contact })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scan failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
