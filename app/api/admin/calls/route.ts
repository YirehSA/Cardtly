import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin-check'
import { serviceClient } from '@/lib/rep-access'
import { auditLog } from '@/lib/admin-audit'
import { parseCallBody, saveCall, deleteCall, listCalls } from '@/lib/rep-calls-server'

// Every rep's call log, for the admin panel.
//
// The rep route resolves rep_id from the session because a rep may only ever
// touch their own. An admin is the opposite case: they are looking at everyone,
// so rep_id has to come from the request. That is safe here for one reason only
// - isAdminUser has already been checked - and it is verified against the reps
// table before anything is written, so a typo cannot create an orphan row.
//
// Admin writes are audited. A rep's log is their record of their own work, and
// someone else changing it should be traceable.

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!await isAdminUser(user.id)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

export async function GET() {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const admin = serviceClient()
  const res = await listCalls(admin)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })

  // Names come along so the log can label by rep without a second round trip.
  const { data: reps } = await admin.from('reps').select('id, name, active').order('name')

  return NextResponse.json({ calls: res.calls, reps: reps || [] })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const actor = gate.user

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const repId = String(body?.rep_id || '').trim()
  if (!repId) return NextResponse.json({ error: 'Choose which rep this call belongs to.' }, { status: 400 })

  const admin = serviceClient()
  const { data: rep, error: repError } = await admin
    .from('reps').select('id, name').eq('id', repId).maybeSingle()
  if (repError) return NextResponse.json({ error: repError.message }, { status: 500 })
  if (!rep) return NextResponse.json({ error: 'That rep does not exist.' }, { status: 404 })

  if (body?.action === 'delete') {
    if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const res = await deleteCall(admin, { id: String(body.id), repId })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
    await auditLog(admin, {
      actorUserId: actor.id, actorEmail: actor.email,
      action: 'rep_call_delete',
      detail: { rep_id: repId, rep_name: rep.name, call_id: body.id },
    })
    return NextResponse.json({ success: true })
  }

  const parsed = parseCallBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // allowReassign: an admin picking a different name in the Rep dropdown means
  // to move the call, and the update has to carry the new rep_id rather than
  // filter on it.
  const res = await saveCall(admin, {
    id: body?.id || null, repId, fields: parsed.fields, allowReassign: true,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })

  await auditLog(admin, {
    actorUserId: actor.id, actorEmail: actor.email,
    action: body?.id ? 'rep_call_update' : 'rep_call_create',
    detail: {
      rep_id: repId, rep_name: rep.name, call_id: res.id,
      company: parsed.fields.company, outcome: parsed.fields.outcome,
    },
  })

  return NextResponse.json({ success: true, id: res.id, call: res.row })
}
