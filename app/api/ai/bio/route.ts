import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { classifyAiError, reportAiFailure } from '@/lib/ai-failure'

// Generates a polished business-card bio from user-supplied details.
// Used by the AI bio writer modal in the card editor. Gated to
// authenticated users to keep our OpenAI bill predictable.
//
// Requires OPENAI_API_KEY in the environment. If not configured,
// returns a friendly error rather than crashing.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    await reportAiFailure('not_configured', 'OPENAI_API_KEY is not set in the environment.', 'bio')
    return NextResponse.json(
      { error: 'The bio writer is temporarily unavailable. We have been alerted and are looking at it.' },
      { status: 503 }
    )
  }

  let body: {
    role?: string
    company?: string
    expertise?: string
    location?: string
    tone?: 'professional' | 'friendly' | 'bold'
    existing_bio?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { role, company, expertise, location, tone = 'professional', existing_bio } = body

  if (!role && !expertise) {
    return NextResponse.json(
      { error: 'Tell me at least your role or your expertise so I have something to work with.' },
      { status: 400 }
    )
  }

  const toneGuide = {
    professional: 'polished, confident, business-formal',
    friendly: 'warm, approachable, conversational',
    bold: 'punchy, opinionated, attention-grabbing',
  }[tone]

  const prompt = [
    `Write a digital business card bio in 2 short paragraphs (max 400 characters total).`,
    `Tone: ${toneGuide}.`,
    role ? `Role: ${role}` : null,
    company ? `Company: ${company}` : null,
    expertise ? `Expertise / specialties: ${expertise}` : null,
    location ? `Based in: ${location}` : null,
    existing_bio ? `Existing bio to improve: "${existing_bio}"` : null,
    `Rules:`,
    `- Write in first person.`,
    `- No em dashes anywhere.`,
    `- No exclamation marks.`,
    `- Keep it human and specific, not corporate fluff.`,
    `- Do not start with "I am" or "Hello".`,
    `- Skip generic phrases like "passionate about" or "dedicated to".`,
    `Return only the bio, no headings or commentary.`,
  ].filter(Boolean).join('\n')

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 250,
    })
    const bio = completion.choices[0]?.message?.content?.trim() || ''
    if (!bio) {
      return NextResponse.json({ error: 'Could not generate a bio. Try again.' }, { status: 500 })
    }
    return NextResponse.json({ bio })
  } catch (err) {
    const failure = classifyAiError(err, 'bio')
    if (failure.ours) {
      await reportAiFailure(failure.kind, err instanceof Error ? err.message : String(err), 'bio')
    }
    return NextResponse.json({ error: failure.userMessage }, { status: failure.status })
  }
}
