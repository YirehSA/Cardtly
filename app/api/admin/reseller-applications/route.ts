import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { adminDb } from '@/lib/admin-api'
import { requireResellerProgramme, adminEmails, staffNameOf } from '@/lib/reseller-programme'
import { auditLog } from '@/lib/admin-audit'
import { FROM_EMAIL } from '@/lib/email'

// Applications from cardtly.com/resellers, for admins and the rep who runs the
// reseller programme (lib/reseller-programme). Two steps since 2026-11-02: he
// recommends one (pending to recommended, and the admins are emailed), then an
// admin gives the final approval, a POST to /api/admin/resellers with its
// application_id that creates the reseller and marks the application approved.
// An admin may approve one he has not recommended yet. This route lists them,
// recommends, takes a recommendation back, declines, and reopens a declined one.

export const runtime = 'nodejs'

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function GET() {
  const gate = await requireResellerProgramme()
  if ('error' in gate) return gate.error
  const db = adminDb()
  const { data, error } = await db.from('reseller_applications').select('*').order('created_at', { ascending: false }).limit(300)
  if (error) {
    return NextResponse.json({ error: 'Reseller applications are not set up on this database yet. Run migration 095.' }, { status: 503 })
  }
  // "Recommended by Anthony McGregor", not a user id.
  const names = new Map<string, string | null>()
  for (const id of new Set((data || []).map((a: any) => a.recommended_by).filter(Boolean))) {
    names.set(id as string, await staffNameOf(db, id as string))
  }
  return NextResponse.json({
    role: gate.role,
    applications: (data || []).map((a: any) => ({ ...a, recommended_by_name: a.recommended_by ? names.get(a.recommended_by) || null : null })),
  })
}

export async function PATCH(request: Request) {
  const gate = await requireResellerProgramme()
  if ('error' in gate) return gate.error
  const db = adminDb()
  const body = await request.json().catch(() => ({}))

  const { data: app } = await db.from('reseller_applications').select('*').eq('id', String(body.id || '')).maybeSingle()
  if (!app) return NextResponse.json({ error: 'No such application.' }, { status: 404 })
  const at = new Date().toISOString()

  // Step one: the programme's manager (or an admin) recommends it. The admins
  // are emailed, and it shows in admin, Today and Resellers, for the final OK.
  if (body.action === 'recommend') {
    if (app.status !== 'pending') return NextResponse.json({ error: `This application is already ${app.status}.` }, { status: 409 })
    const note = String(body.note ?? '').trim().slice(0, 1000) || null
    const { data: done, error } = await db.from('reseller_applications').update({
      status: 'recommended', recommended_by: gate.user.id, recommended_at: at, recommendation_note: note, updated_at: at,
    }).eq('id', app.id).eq('status', 'pending').select('id')
    if (error) {
      const missing = /recommend|status_check/.test(error.message || '')
      return NextResponse.json({ error: missing ? 'Recommending needs migration 098. Run it in Supabase, then try again.' : (error.message || 'Could not save.') }, { status: missing ? 503 : 500 })
    }
    if (!done?.length) return NextResponse.json({ error: 'That application was just decided by someone else.' }, { status: 409 })

    let warning: string | undefined
    const to = await adminEmails(db)
    if (to.length && process.env.RESEND_API_KEY) {
      const who = (await staffNameOf(db, gate.user.id)) || gate.user.email || 'The reseller programme'
      const { error: sendErr } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: FROM_EMAIL,
        to,
        subject: `Reseller to approve: ${app.trading_name}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#111">
            <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 14px">
              ${esc(who)} recommends <strong>${esc(app.trading_name)}</strong> as a Cardtly reseller.
            </p>
            ${note ? `<p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 14px;padding:12px 14px;background:#f3f4f6;border-radius:8px">${esc(note)}</p>` : ''}
            <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 18px">
              The final approval is yours: set their seat pool and prices, then approve, and they get their login.
            </p>
            <a href="https://www.cardtly.com/admin?tab=resellers" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:10px">Open Resellers in admin</a>
          </div>`,
      })
      if (sendErr) warning = 'Recommended, but the email to the admins did not send. It still shows in their admin.'
    }
    await auditLog(db, {
      actorUserId: gate.user.id, actorEmail: gate.user.email, action: 'recommend_reseller_application',
      targetEmail: app.email, detail: { application_id: app.id, trading_name: app.trading_name, note },
    })
    return NextResponse.json({ ok: true, ...(warning ? { warning } : {}) })
  }

  // Back to pending: the recommender changed their mind, or an admin wants it
  // looked at again.
  if (body.action === 'unrecommend') {
    if (app.status !== 'recommended') return NextResponse.json({ error: 'Only a recommended application can be taken back.' }, { status: 409 })
    await db.from('reseller_applications').update({
      status: 'pending', recommended_by: null, recommended_at: null, recommendation_note: null, updated_at: at,
    }).eq('id', app.id).eq('status', 'recommended')
    await auditLog(db, {
      actorUserId: gate.user.id, actorEmail: gate.user.email, action: 'unrecommend_reseller_application',
      targetEmail: app.email, detail: { application_id: app.id },
    })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'decline') {
    if (app.status !== 'pending' && app.status !== 'recommended') return NextResponse.json({ error: `This application is already ${app.status}.` }, { status: 409 })
    const note = String(body.note ?? '').trim().slice(0, 1000) || null
    const { error } = await db.from('reseller_applications').update({
      status: 'declined', decided_by: gate.user.id, decided_at: at, decision_note: note, updated_at: at,
    }).eq('id', app.id).eq('status', app.status)
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
