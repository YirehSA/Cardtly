import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { FROM_EMAIL } from '@/lib/email'

// Contact page form handler. Distinct from /api/contact, which is
// the lead-capture endpoint for public card "share your details"
// forms. This one emails the message to the Cardtly inbox via
// Resend - previously the contact page only pretended to send.

const resend = new Resend(process.env.RESEND_API_KEY)
// Where contact-page messages land. Two addresses, on purpose.
//
// andre@cardtly.com is the intended one, moved here from info@yireh.co.za on
// 2026-07-19. It then appeared not to be arriving. Resend's own logs say
// otherwise: both the contact message and that morning's weekly digest show
// last_event "delivered" to that address, SPF on send.cardtly.com and the
// resend._domainkey DKIM record are both present, and the domain is verified.
// So the mail is being accepted by mx1.cpmx.co.za and something past that
// point - a spam folder, a forwarder, a catch-all - is where it goes.
//
// info@yireh.co.za rides along until that is settled. It was the recipient
// until the day before and delivers reliably, so it exposes nothing new and
// costs a duplicate email; a contact form silently dropping leads costs a
// customer. Drop it once the cardtly.com mailbox is confirmed being read.
//
// Worth remembering generally: Resend returning no error means accepted for
// delivery, not delivered. Anything that fails after that fails out of sight,
// so confirm arrival by looking in the inbox, not at the response.
const TO_EMAILS = ['andre@cardtly.com', 'info@yireh.co.za']

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, topic, message, website } = body

    // Honeypot: the form has a hidden "website" field humans never
    // fill. Bots that stuff every field get a fake success.
    if (website) {
      return NextResponse.json({ success: true })
    }

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Please fill in your name, email, and message.' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }
    if (message.length > 5000 || name.length > 200) {
      return NextResponse.json({ error: 'Message is too long.' }, { status: 400 })
    }

    const cleanName = name.trim()
    const cleanEmail = email.trim()
    const cleanTopic = (topic || 'General').toString().slice(0, 100)

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAILS,
      replyTo: cleanEmail,
      subject: `Contact form: ${cleanTopic} — ${cleanName}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
          <h2 style="margin:0 0 16px;font-size:20px">New message from the Cardtly contact page</h2>
          <div style="background:#f6f6f6;border-radius:12px;padding:18px;margin-bottom:16px">
            <p style="margin:0 0 6px"><strong>From:</strong> ${esc(cleanName)} &lt;${esc(cleanEmail)}&gt;</p>
            <p style="margin:0 0 6px"><strong>Topic:</strong> ${esc(cleanTopic)}</p>
          </div>
          <div style="border-left:3px solid #7c3aed;padding-left:14px;white-space:pre-wrap">${esc(message.trim())}</div>
          <p style="margin:20px 0 0;color:#888;font-size:12px">Reply to this email to answer ${esc(cleanName)} directly.</p>
        </div>
      `,
    })

    if (error) {
      return NextResponse.json({ error: 'Could not send your message. Please email us directly.' }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
