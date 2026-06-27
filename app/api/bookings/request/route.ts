import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { resolveCardOwner } from '@/lib/card-owner'
import { waLink } from '@/lib/whatsapp'

// Public endpoint: a visitor on someone's card submits a meeting
// request. We store it in the bookings table, fire an email to the
// card owner via Resend, and add the visitor to the owner's
// contacts list so they don't have to enter the info twice if they
// also want to follow up. Works for personal and team cards; for
// team cards the contact is stored under team_card_id so the team
// admin sees it in Team Contacts.

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

  // Resolve the owner + correct storage column. card_id here may be a
  // personal card id or a team card id - the resolver detects which.
  const owner = await resolveCardOwner(admin, card_id)
  if (!owner.found) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }
  const cardName = owner.cardName

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

  // Also add to contacts so the owner (and, for team cards, the team
  // admin) sees the request in the dashboard. Stored under the correct
  // column so team-card bookings show in Team Contacts. We log any
  // failure loudly rather than swallowing it - this is a required
  // surface, not best-effort. Migration 013 guarantees the schema
  // (nullable card_id + team_card_id) this insert depends on.
  const { error: contactErr } = await admin.from('contacts').insert({
    card_id: owner.personalCardId,
    team_card_id: owner.teamCardId,
    name: requester_name.trim(),
    email: requester_email.trim(),
    phone: requester_phone?.trim() || null,
    message: `Booking request for ${preferred_date}${preferred_time ? ' at ' + preferred_time : ''}.${notes ? '\n\nNote: ' + notes : ''}`,
    source: 'booking',
  })
  if (contactErr) {
    console.error('bookings: failed to store contact', contactErr)
  }

  // Notify the card owner via Resend (their card email + account email)
  if (process.env.RESEND_API_KEY && owner.ownerEmails.length > 0) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: owner.ownerEmails,
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
            ${waLink(requester_phone, `Hi ${requester_name.trim().split(' ')[0]}, about your meeting request on my Cardtly card...`) ? `<a href="${waLink(requester_phone, `Hi ${requester_name.trim().split(' ')[0]}, about your meeting request on my Cardtly card...`)}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;margin-bottom:8px">Confirm on WhatsApp</a>` : ''}
            <p style="font-size:12px;color:#888;margin:24px 0 0">Card: ${cardName}. Sent via Cardtly.${owner.isTeam ? ' Your team admin can also see this in Team Contacts.' : ''}</p>
          </div>
        `,
      })
    } catch {
      // Email send failed - the request is still saved and visible in contacts
    }
  }

  return NextResponse.json({ success: true })
}
