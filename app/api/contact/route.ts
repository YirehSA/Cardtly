import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { resolveCardOwner } from '@/lib/card-owner'
import { waLink } from '@/lib/whatsapp'
import { FROM_EMAIL } from '@/lib/email'

// Public endpoint: a visitor fills in the "share your info" form on a
// card. We store the lead and email the card owner. Works for both
// personal and team cards; for team cards the lead is stored under
// team_card_id so the team admin sees it in Team Contacts.


function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

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

    // Email the card owner so the lead reaches them immediately - not
    // just the dashboard. Reply-to is the visitor so a reply answers
    // them directly. Non-fatal: the lead is already saved.
    if (process.env.RESEND_API_KEY && owner.ownerEmails.length > 0) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: FROM_EMAIL,
          to: owner.ownerEmails,
          replyTo: email,
          subject: `New contact from ${name} on your Cardtly card`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
              <h2 style="margin:0 0 16px;font-size:20px">Someone shared their details with you</h2>
              <p style="margin:0 0 16px;color:#555">A visitor filled in the contact form on your Cardtly card. Reply to this email to reach them.</p>
              <div style="background:#f6f6f6;border-radius:12px;padding:18px;margin-bottom:16px">
                <p style="margin:0 0 6px"><strong>Name:</strong> ${esc(name)}</p>
                <p style="margin:0 0 6px"><strong>Email:</strong> ${esc(email)}</p>
                ${phone ? `<p style="margin:0 0 6px"><strong>Phone:</strong> ${esc(phone)}</p>` : ''}
                ${message ? `<p style="margin:12px 0 0;white-space:pre-wrap"><strong>Message:</strong> ${esc(message)}</p>` : ''}
              </div>
              ${waLink(phone, `Hi ${name.split(' ')[0]}, thanks for reaching out via my Cardtly card.`) ? `<a href="${waLink(phone, `Hi ${name.split(' ')[0]}, thanks for reaching out via my Cardtly card.`)}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;margin-bottom:8px">Reply on WhatsApp</a>` : ''}
              <p style="font-size:12px;color:#888;margin:24px 0 0">Card: ${esc(owner.cardName)}. Sent via Cardtly.${owner.isTeam ? ' Your team admin can also see this in Team Contacts.' : ''}</p>
            </div>
          `,
        })
      } catch {
        // Email failed - the lead is still saved and visible in the dashboard.
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
