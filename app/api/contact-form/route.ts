import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { FROM_EMAIL } from '@/lib/email'

// Contact page form handler. Distinct from /api/contact, which is
// the lead-capture endpoint for public card "share your details"
// forms. This one emails the message to the Cardtly inbox via
// Resend - previously the contact page only pretended to send.

const resend = new Resend(process.env.RESEND_API_KEY)
// Where contact-page messages land. Moved off info@yireh.co.za on
// Andre's instruction (2026-07-19): contact-page mail should arrive on
// the Cardtly domain rather than the Yireh one.
//
// cardtly.com accepts inbound mail - its MX points at mx1.cpmx.co.za -
// so this is deliverable at the domain level. What that does not prove
// is that this particular mailbox or alias exists on that server. If it
// does not, Resend reports a send with no error here and the message is
// bounced afterwards, out of sight: every contact-form submission would
// be lost silently. Send a test message through /contact after any change
// here and confirm it arrives, rather than assuming a green response
// means delivered.
const TO_EMAIL = 'andre@cardtly.com'

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
      to: TO_EMAIL,
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
