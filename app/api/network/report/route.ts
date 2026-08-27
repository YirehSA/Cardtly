import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { validateReport } from '@/lib/moderation'

// POST /api/network/report
// Body: { card_id? , team_card_id?, reason, detail? }
//
// Anyone can report a card, signed in or not. The person best placed to notice
// an impersonation is usually the one being impersonated, and they may well
// not have a Cardtly account - requiring one would close the door on exactly
// the report that matters most.

export async function POST(request: Request) {
  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const checked = validateReport(body)
  if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: 400 })

  const { card_id, team_card_id } = body
  if (!card_id === !team_card_id) {
    return NextResponse.json({ error: 'Say which card this is about.' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any

  // The card is looked up rather than trusted, so a report always names a real
  // card and carries a snapshot of it - the name and link survive the card
  // being deleted, which is what happens when the report is upheld.
  const table = card_id ? 'cards' : 'team_cards'
  const { data: card } = await admin
    .from(table).select('id, name, slug').eq('id', card_id || team_card_id).maybeSingle()
  if (!card) return NextResponse.json({ error: 'That card does not exist.' }, { status: 404 })

  // Who reported it, if they happen to be signed in. Never required.
  let reporter: string | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    reporter = user?.id || null
  } catch {
    reporter = null
  }

  const { error } = await admin.from('card_reports').insert({
    reporter_user_id: reporter,
    card_id: card_id || null,
    team_card_id: team_card_id || null,
    card_slug: card.slug || '',
    card_name: card.name || null,
    reason: checked.reason,
    detail: checked.detail,
  })

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ error: 'Reporting is not enabled yet. Please email hello@cardtly.com.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Could not send that report. Please email hello@cardtly.com.' }, { status: 500 })
  }

  // Deliberately does not say whether the card was already reported, or how
  // many times. That is somebody else's business.
  return NextResponse.json({ success: true })
}
