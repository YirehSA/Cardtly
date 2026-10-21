import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireAdmin, adminDb } from '@/lib/admin-api'
import { auditLog } from '@/lib/admin-audit'
import { FROM_EMAIL } from '@/lib/email'

// Admin: applications from cardtly.com/resellers. Approving one is a POST to
// /api/admin/resellers with its application_id, which creates the reseller from
// these details and marks the application approved in the same step. This route
// lists them, declines them, and puts a declined one back to pending.

export const runtime = 'nodejs'

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function GET() {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const db = adminDb()
  const { data, error } = await db.from('reseller_applications').select('*').order('created_at', { ascending: false }).limit(300)
  if (error) {
    return NextResponse.json({ error: 'Reseller applications are not set up on this database yet. Run migration 095.' }, { status: 503 })
  }
  return NextResponse.json({ applications: data || [] })
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const db = adminDb()
  const body = await request.json().catch(() => ({}))

  const { data: app } = await db.from('reseller_applications').select('*').eq('id', String(body.id || '')).maybeSingle()
  if (!app) return NextResponse.json({ error: 'No such application.' }, { status: 404 })
  const at = new Date().toISOString()

  if (body.action === 'decline') {
    if (app.status !== 'pending') return NextResponse.json({ error: `This application is already ${app.status}.` }, { status: 409 })
    const note = String(body.note ?? '').trim().slice(0, 1000) || null
    const { error } = await db.from('reseller_applications').update({
      status: 'declined', decided_by: gate.user.id, decided_at: at, decision_note: note, updated_at: at,
    }).eq('id', app.id).eq('status', 'pending')
    if (error) return NextResponse.json({ error: error.message || 'Could not save.' }, { status: 500 })

    let warning: string | undefined
    if (body.notify && process.env.RESEND_API_KEY) {
      // A polite no, and nothing from the internal note: that is for us.
      const { error: sendErr } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: FROM_EMAIL,
        to: app.email,
        subject: 'Your Cardtly reseller application',
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#111">
            <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 14px">Hi ${esc(String(app.contact_name || '').split(' ')[0] || 'there')},</p>
            <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 14px">
              Thank you for applying to resell Cardtly as ${esc(app.trading_name)}. We have looked at it carefully and are not able to take it further right now.
            </p>
            <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 14px">
              If things change on your side, you are welcome to apply again, or to reply to this email with any questions.
            </p>
            <p style="font-size:13px;color:#9ca3af;margin:18px 0 0">The Cardtly team</p>
          </div>`,
      })
      if (sendErr) warning = `Declined, but the email to ${app.email} did not send.`
    }
    await auditLog(db, {
      actorUserId: gate.user.id, actorEmail: gate.user.email, action: 'decline_reseller_application',
      targetEmail: app.email, detail: { application_id: app.id, trading_name: app.trading_name, notified: !!body.notify },
    })
    return NextResponse.json({ ok: true, ...(warning ? { warning } : {}) })
  }

  if (body.action === 'reopen') {
    if (app.status !== 'declined') return NextResponse.json({ error: 'Only a declined application can be reopened.' }, { status: 409 })
    await db.from('reseller_applications').update({
      status: 'pending', decided_by: null, decided_at: null, updated_at: at,
    }).eq('id', app.id)
    await auditLog(db, {
      actorUserId: gate.user.id, actorEmail: gate.user.email, action: 'reopen_reseller_application',
      targetEmail: app.email, detail: { application_id: app.id },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
