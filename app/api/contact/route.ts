import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sanitiseContactMetadata, canonicaliseContactMetadata, readCardContext } from '@/lib/card-context'
import { enqueueLeadCreated } from '@/lib/webhook-dispatch'
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

    // CONTEXT ATTRIBUTION, CHECKED TWICE. The shape is allow-listed first,
    // then re-checked against what this card actually offers, with the label
    // taken from the configuration rather than from the browser. The public
    // card reads its Context out of this same row's `addons`, so the two
    // cannot disagree about what an audience is called.
    //
    // Every failure here degrades to "no attribution" and never to "no
    // contact". A lead is worth more than the label on it.
    let contextMeta = sanitiseContactMetadata(body.metadata)
    if (contextMeta) {
      try {
        const table = owner.isTeam ? 'team_cards' : 'cards'
        const idCol = owner.isTeam ? owner.teamCardId : owner.personalCardId
        const { data: row } = await admin.from(table).select('addons').eq('id', idCol).maybeSingle()
        contextMeta = canonicaliseContactMetadata(contextMeta, readCardContext(row?.addons).config)
      } catch {
        contextMeta = null
      }
    }

    const { data: saved, error } = await admin
      .from('contacts')
      .insert({
        card_id:      owner.personalCardId,
        team_card_id: owner.teamCardId,
        name,
        email,
        phone:   phone || null,
        message: message || null,
        source:  'card_form',
        // Validated against an allow-list. Only named when present, so an
        // ordinary exchange never references the column and this is safe to
        // deploy before migration 081 runs.
        ...(contextMeta ? { metadata: contextMeta } : {}),
      })
      .select('id')
      .single()

    if (error) {
      // The raw Postgres message names tables, columns and constraints. This
      // endpoint is anonymous and public, so that goes to the server log and
      // the visitor gets a generic failure. Same rule as /api/analytics.
      console.error('contact insert failed', { code: (error as any)?.code ?? null, message: (error as any)?.message ?? null })
      return NextResponse.json({ error: 'Could not save your details' }, { status: 500 })
    }

    // Queue the lead for any CRM the team has connected. Never awaited for
    // its result and never able to throw: the lead is already saved, and a
    // customer's integration must not decide whether a visitor sees success.
    await enqueueLeadCreated(admin, {
      contactId: saved.id,
      teamCardId: owner.teamCardId,
      personalCardId: owner.personalCardId,
    })

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
