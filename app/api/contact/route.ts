import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { resolveCardOwner } from '@/lib/card-owner'
import { notifyLeadRecipients } from '@/lib/lead-notify'

// Public endpoint: a visitor fills in the "share your info" form on a
// card. We store the lead and email the card owner. Works for both
// personal and team cards; for team cards the lead is stored under
// team_card_id so the team admin sees it in Team Contacts.

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { card_id, team_card_id, name, email, phone, message } = body

    if (!name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!card_id && !team_card_id) {
      return NextResponse.json({ error: 'Missing card reference' }, { status: 400 })
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    // Resolve the owner (and the correct storage column) from whichever
    // id we were given.
    const owner = await resolveCardOwner(admin, card_id || team_card_id)
    if (!owner.found) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    const { error } = await admin
      .from('contacts')
      .insert({
        card_id:      owner.personalCardId,
        team_card_id: owner.teamCardId,
        name,
        email,
        phone:   phone || null,
        message: message || null,
        source:  'card_form',
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Email the card owner so the lead reaches them immediately - not just the
    // dashboard - and copy their team admin. Non-fatal: the lead is saved.
    await notifyLeadRecipients(
      admin,
      owner,
      { name, email, phone, message },
      {
        subject: `New contact from ${name} on your Cardtly card`,
        heading: 'Someone shared their details with you',
        intro: 'A visitor filled in the contact form on your Cardtly card.',
        adminNoun: 'contact',
        adminAction: 'filled in the contact form on',
      }
    )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
