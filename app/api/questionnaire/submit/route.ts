import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { resolveCardOwner } from '@/lib/card-owner'
import { notifyLeadRecipients } from '@/lib/lead-notify'

// Public endpoint: a visitor submits a card's custom questionnaire.
// Saves a contact (source='questionnaire') with the standard fields
// plus the custom answers, so it shows in the owner's Contacts, and
// emails the card owner - the same as the card contact form and a
// booking request. A questionnaire is a lead like any other, and it
// used to save silently, so the owner only found it if they went
// looking in the dashboard.
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

  // Resolve the owner from whichever id we were given. This also decides the
  // correct storage column rather than trusting what the client sent, so the
  // lead lands in the right dashboard.
  const owner = await resolveCardOwner(admin, body.card_id || body.team_card_id || '')
  if (!owner.found) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  const name = body.name.trim()
  const email = body.email.trim()
  const phone = body.phone?.trim() || null
  const company = body.company?.trim() || null
  const message = body.message?.trim() || null

  const { error } = await admin.from('contacts').insert({
    card_id: owner.personalCardId,
    team_card_id: owner.teamCardId,
    name,
    email,
    phone,
    company,
    message,
    answers: answers.length ? answers : null,
    source: 'questionnaire',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Non-fatal: the lead is saved either way.
  await notifyLeadRecipients(
    admin,
    owner,
    { name, email, phone, company, message, answers },
    {
      subject: `New questionnaire reply from ${name} on your Cardtly card`,
      heading: 'Someone completed your questionnaire',
      intro: 'A visitor filled in the questionnaire on your Cardtly card.',
      adminNoun: 'questionnaire reply',
      adminAction: 'filled in the questionnaire on',
    }
  )

  return NextResponse.json({ success: true })
}
