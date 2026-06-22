import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Public endpoint: a visitor submits a card's custom questionnaire.
// Saves a contact (source='questionnaire') with the standard fields
// plus the custom answers, so it shows in the owner's Contacts.
export async function POST(request: Request) {
  let body: {
    card_id?: string | null
    team_card_id?: string | null
    name?: string; email?: string; phone?: string; company?: string; message?: string
    answers?: { label: string; value: string }[]
  }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  if (!body.name?.trim() || !body.email?.trim()) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }
  if (!body.card_id && !body.team_card_id) {
    return NextResponse.json({ error: 'Missing card reference' }, { status: 400 })
  }

  // Keep only well-formed, non-empty answer pairs.
  const answers = Array.isArray(body.answers)
    ? body.answers
        .filter(a => a && typeof a.label === 'string' && typeof a.value === 'string' && a.value.trim())
        .map(a => ({ label: a.label.slice(0, 200), value: a.value.trim().slice(0, 1000) }))
        .slice(0, 5)
    : []

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const { error } = await admin.from('contacts').insert({
    card_id: body.card_id || null,
    team_card_id: body.team_card_id || null,
    name: body.name.trim(),
    email: body.email.trim(),
    phone: body.phone?.trim() || null,
    company: body.company?.trim() || null,
    message: body.message?.trim() || null,
    answers: answers.length ? answers : null,
    source: 'questionnaire',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
