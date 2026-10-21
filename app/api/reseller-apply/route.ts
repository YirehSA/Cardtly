import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { FROM_EMAIL } from '@/lib/email'
import { checkApplication, addressLine, MIN_FILL_MS } from '@/lib/reseller-application'

// The form on cardtly.com/resellers. Public, so it is careful:
//
//   - a hidden "website" field and a minimum time to fill the form in, which
//     together stop the scripts that post every form they find. Both answer
//     with an ordinary success, so a bot learns nothing;
//   - everything is checked and cut to length on the server (the same check the
//     page runs), and written with the service role, because the table is
//     closed to the browser;
//   - a second application from an address that already has one pending is
//     not stored again, so pressing Send twice is harmless.
//
// Then Cardtly is told, with every detail, and the applicant gets a receipt.

export const runtime = 'nodejs'

// The same inboxes as the contact form (see app/api/contact-form).
const TO_EMAILS = ['andre@cardtly.com', 'info@yireh.co.za']

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })

  // Quietly accept what only a bot sends.
  const fillMs = Number(body.fill_ms)
  if (body.website_url || !Number.isFinite(fillMs) || fillMs < MIN_FILL_MS) {
    return NextResponse.json({ success: true })
  }

  const checked = checkApplication(body)
  if (!checked.ok) return NextResponse.json({ error: checked.error, field: checked.field }, { status: 400 })
  const a = checked.data

  const db = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any

  const { data: already } = await db.from('reseller_applications')
    .select('id').eq('status', 'pending').eq('email', a.email).limit(1)
  if (already?.length) return NextResponse.json({ success: true, duplicate: true })

  const { error } = await db.from('reseller_applications').insert({
    ...a, consented_at: new Date().toISOString(),
  })
  if (error) {
    console.error('reseller application insert failed', error)
    return NextResponse.json({ error: 'We could not save your application. Please try again, or email hello@cardtly.com.' }, { status: 500 })
  }

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const rows: Array<[string, string | null]> = [
      ['Business', a.trading_name],
      ['Registered name', a.registered_name],
      ['Registration number', a.registration_number],
      ['VAT number', a.vat_number],
      ['Type of business', a.business_type],
      ['Website', a.website],
      ['Address', addressLine(a)],
      ['Contact', `${a.contact_name}${a.contact_role ? `, ${a.contact_role}` : ''}`],
      ['Email', a.email],
      ['Phone', a.phone],
      ['Clients in 6 months', a.expected_clients],
      ['Cards in the first year', a.expected_seats],
      ['NFC printing', a.printing],
      ['Heard about us', a.heard_about],
    ]
    const table = rows.filter(([, v]) => v).map(([k, v]) =>
      `<tr><td style="padding:6px 14px 6px 0;color:#6b7280;font-size:13px;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-size:14px;color:#111">${esc(v)}</td></tr>`).join('')

    // Best-effort: the application is saved and visible in admin either way.
    await Promise.allSettled([
      resend.emails.send({
        from: FROM_EMAIL,
        to: TO_EMAILS,
        replyTo: a.email,
        subject: `Reseller application: ${a.trading_name}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:580px;margin:0 auto;padding:24px;color:#111">
            <h2 style="margin:0 0 6px;font-size:20px">New reseller application</h2>
            <p style="margin:0 0 16px;color:#555">Review it under Admin, Customers, Resellers. Reply to this email to reach ${esc(a.contact_name)}.</p>
            <table role="presentation" style="border-collapse:collapse;width:100%;background:#f6f7f9;border-radius:12px;padding:12px">${table}</table>
            <p style="margin:16px 0 4px;font-weight:600">Their clients and how they would sell Cardtly</p>
            <div style="border-left:3px solid #7c3aed;padding-left:12px;white-space:pre-wrap;color:#333">${esc(a.pitch)}</div>
          </div>`,
      }),
      resend.emails.send({
        from: FROM_EMAIL,
        to: a.email,
        subject: 'We have your Cardtly reseller application',
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#111">
            <h1 style="font-size:21px;margin:0 0 10px">Thanks, ${esc(a.contact_name.split(' ')[0] || a.contact_name)}</h1>
            <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 14px">
              We have your application to resell Cardtly as <strong>${esc(a.trading_name)}</strong>. We read every one ourselves and will come back to you soon, usually within two working days.
            </p>
            <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 14px">
              If it is approved, you get your own reseller login, where you add your clients and order NFC cards, and we take you through pricing.
            </p>
            <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:18px 0 0">
              Questions in the meantime? Reply to this email or write to hello@cardtly.com.
            </p>
          </div>`,
      }),
    ])
  }

  return NextResponse.json({ success: true })
}
