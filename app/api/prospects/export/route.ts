import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { serviceClient } from '@/lib/rep-access'
import { auditLog } from '@/lib/admin-audit'
import { FROM_EMAIL } from '@/lib/email'
import { listProspects, prospectActor, saToday } from '@/lib/prospects-server'
import { exportFilename, mailMergeWorkbook, prospectsPdf, prospectsWorkbook } from '@/lib/prospects-export'
import { mailMergeList } from '@/lib/prospects'

// The list as a file, or mailed as one. Whatever the board is showing: the ids
// come from the browser, and are only ever used to narrow what this person may
// already see, so a made-up id reaches nothing.
//
// Every export and email is written to the audit log, because this is a list of
// other people's contact details leaving the system.

export const runtime = 'nodejs'
export const maxDuration = 60

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function POST(request: Request) {
  const gate = await prospectActor()
  if ('error' in gate) return gate.error
  const { actor } = gate

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const admin = serviceClient()
  const { rows: all, error, missing } = await listProspects(admin, actor)
  if (error || missing) return NextResponse.json({ error: error || 'Prospects are not switched on yet.' }, { status: 500 })

  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : []
  const wanted = new Set(ids)
  const rows = all.filter(r => wanted.has(r.id))
  if (rows.length === 0) return NextResponse.json({ error: 'Nothing to export. Clear the filter or tick some rows.' }, { status: 400 })

  const today = saToday()
  const scope = String(body?.scope || 'Reseller prospects').slice(0, 160)
  const repNames = new Map<string, string>()
  if (actor.isAdmin) {
    const { data } = await admin.from('reps').select('id, name')
    for (const r of data || []) repNames.set(r.id, r.name)
  } else if (actor.repId) {
    repNames.set(actor.repId, actor.repName || '')
  }
  const repName = (p: { rep_id: string | null }) => (p.rep_id && repNames.get(p.rep_id)) || ''

  const audit = (action: string, detail: Record<string, any>) => auditLog(admin, {
    actorUserId: actor.userId, actorEmail: actor.email, action, detail: { count: rows.length, scope, ...detail },
  })

  // ── Mail it ───────────────────────────────────────────────────────────────
  if (body?.action === 'email') {
    const to = String(body?.to || '').split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
    if (to.length === 0) return NextResponse.json({ error: 'Who should it go to?' }, { status: 400 })
    if (to.length > 5) return NextResponse.json({ error: 'Send it to five people at most.' }, { status: 400 })
    const badAddress = to.find(a => !EMAIL.test(a))
    if (badAddress) return NextResponse.json({ error: `"${badAddress}" does not look like an email address.` }, { status: 400 })

    const formats: string[] = Array.isArray(body?.formats) ? body.formats : []
    if (!formats.includes('xlsx') && !formats.includes('pdf')) return NextResponse.json({ error: 'Choose Excel, PDF or both.' }, { status: 400 })
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Email is not set up here.' }, { status: 503 })

    const attachments: { filename: string; content: string }[] = []
    if (formats.includes('xlsx')) {
      const file = await prospectsWorkbook(rows, { scope, today, repName })
      attachments.push({ filename: exportFilename('list', 'xlsx', today), content: file.toString('base64') })
    }
    if (formats.includes('pdf')) {
      const file = await prospectsPdf(rows, { scope, today })
      attachments.push({ filename: exportFilename('list', 'pdf', today), content: file.toString('base64') })
    }

    const note = String(body?.message || '').trim().slice(0, 2000)
    const sender = actor.repName || actor.email || 'Cardtly'
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const { error: sendErr } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: FROM_EMAIL,
      to,
      // A reply should reach the person who sent it, not the shared inbox.
      ...(actor.email ? { replyTo: actor.email } : {}),
      subject: `Reseller prospects: ${rows.length} contact${rows.length === 1 ? '' : 's'}`,
      html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
        <p style="margin:0 0 12px">${esc(sender)} sent you the Cardtly reseller prospect list: <strong>${rows.length} contact${rows.length === 1 ? '' : 's'}</strong>.</p>
        ${note ? `<p style="white-space:pre-wrap;margin:0 0 12px">${esc(note)}</p>` : ''}
        <p style="color:#666;font-size:13px;margin:0">${esc(scope)}. It is attached. It holds business contact details, so please keep it within Cardtly.</p>
      </div>`,
      attachments,
    })
    if (sendErr) {
      console.error('prospect email failed', sendErr)
      return NextResponse.json({ error: 'That email did not send. Please try again.' }, { status: 502 })
    }
    await audit('prospects_emailed', { to, formats })
    return NextResponse.json({ success: true, sent: to.length })
  }

  // ── Download it ───────────────────────────────────────────────────────────
  const format = String(body?.format || 'xlsx')
  let file: Buffer
  let filename: string
  let type = XLSX

  if (format === 'merge') {
    const merge = mailMergeList(rows, all, body?.explicit === true)
    if (merge.send.length === 0) {
      return NextResponse.json({ error: `Nobody to send to in this view: all ${rows.length} were left out. Tick the rows you want, or change the filter.` }, { status: 400 })
    }
    file = await mailMergeWorkbook(merge)
    filename = exportFilename('merge', 'xlsx', today)
  } else if (format === 'pdf') {
    file = await prospectsPdf(rows, { scope, today })
    filename = exportFilename('list', 'pdf', today)
    type = 'application/pdf'
  } else {
    file = await prospectsWorkbook(rows, { scope, today, repName })
    filename = exportFilename('list', 'xlsx', today)
  }

  await audit('prospects_exported', { format })
  return new NextResponse(new Uint8Array(file), {
    headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' },
  })
}
