import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Public endpoint: a visitor on someone's card submits a meeting
// request. We store it in the bookings table, fire an email to the
// card owner via Resend, and add the visitor to the owner's
// contacts list so they don't have to enter the info twice if they
// also want to follow up.

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = 'noreply@cardtly.com'

export async function POST(request: Request) {
  let body: {
    card_id?: string
    requester_name?: string
    requester_email?: string
    requester_phone?: string
    preferred_date?: string
    preferred_time?: string
    notes?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const {
    card_id, requester_name, requester_email, requester_phone,
    preferred_date, preferred_time, notes,
  } = body

  if (!card_id || !requester_name?.trim() || !requester_email?.trim() || !preferred_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Look up the card to find the owner. Supports both personal and
  // team cards via separate tables.
  let owner: { email: string; name: string } | null = null
  let cardName = ''

  const { data: personalCard } = await admin
    .from('cards')
    .select('id, name, email, user_id')
    .eq('id', card_id)
    .maybeSingle()

  if (personalCard) {
    owner = { email: personalCard.email || '', name: personalCard.name || '' }
    cardName = personalCard.name || ''
  } else {
    const { data: teamCard } = await admin
      .from('team_cards')
      .select('id, name, email, organization_id')
      .eq('id', card_id)
      .maybeSingle()
    if (teamCard) {
      owner = { email: teamCard.email || '', name: teamCard.name || '' }
      cardName = teamCard.name || ''
    }
  }

  if (!owner) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }

  // Store the booking request. Falls through silently if the
  // bookings table does not exist yet so the email still sends.
  try {
    await admin.from('bookings').insert({
      card_id,
      requester_name: requester_name.trim(),
      requester_email: requester_email.trim(),
      requester_phone: requester_phone?.trim() || null,
      preferred_date,
      preferred_time: preferred_time?.trim() || null,
      notes: notes?.trim() || null,
      status: 'pending',
    })
  } catch {
    // table missing or RLS - non-fatal
  }

  // Also add to contacts so the card owner has them in their CRM-ish view
  try {
    await admin.from('contacts').insert({
      card_id,
      name: requester_name.trim(),
      email: requester_email.trim(),
      phone: requester_phone?.trim() || null,
      message: `Booking request for ${preferred_date}${preferred_time ? ' at ' + preferred_time : ''}.${notes ? '\n\nNote: ' + notes : ''}`,
      source: 'booking',
    })
  } catch {
    // ignore
  }

  // Notify the card owner via Resend
  if (process.env.RESEND_API_KEY && owner.email) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: owner.email,
        replyTo: requester_email.trim(),
        subject: `New booking request from ${requester_name.trim()}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
            <h2 style="margin:0 0 16px;font-size:20px">New meeting request on your Cardtly card</h2>
            <p style="margin:0 0 16px;color:#555">Someone wants to meet with you. Reply to this email to confirm.</p>
            <div style="background:#f6f6f6;border-radius:12px;padding:18px;margin-bottom:16px">
              <p style="margin:0 0 6px"><strong>From:</strong> ${requester_name.trim()} &lt;${requester_email.trim()}&gt;</p>
              ${requester_phone ? `<p style="margin:0 0 6px"><strong>Phone:</strong> ${requester_phone}</p>` : ''}
              <p style="margin:0 0 6px"><strong>Preferred date:</strong> ${preferred_date}${preferred_time ? ' at ' + preferred_time : ''}</p>
              ${notes ? `<p style="margin:12px 0 0;white-space:pre-wrap"><strong>Note:</strong> ${notes}</p>` : ''}
            </div>
            <p style="font-size:12px;color:#888;margin:24px 0 0">Card: ${cardName}. Sent via Cardtly.</p>
          </div>
        `,
      })
    } catch {
      // Email send failed - the request is still saved and visible in contacts
    }
  }

  return NextResponse.json({ success: true })
}
