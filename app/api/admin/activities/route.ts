import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin-check'
import { serviceClient } from '@/lib/rep-access'
import { auditLog } from '@/lib/admin-audit'
import {
  parseActivityBody, saveActivity, deleteActivity, listActivities,
} from '@/lib/rep-activities-server'

// Every rep's outreach log, for the admin panel.
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
  const res = await listActivities(admin)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })

  const { data: reps } = await admin.from('reps').select('id, name, active').order('name')

  // Names attached here rather than joined, the same as the calls route: the
  // log labels every row by rep and a second round trip for one string per row
  // is not worth a foreign table read.
  const nameById: Record<string, string> = Object.fromEntries(
    (reps || []).map((r: any) => [r.id, r.name]))
  const activities = res.activities.map((a: any) => ({ ...a, repName: nameById[a.rep_id] || null }))

  return NextResponse.json({ activities, reps: reps || [] })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const actor = gate.user

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const repId = String(body?.rep_id || '').trim()
  if (!repId) return NextResponse.json({ error: 'Choose which rep this belongs to.' }, { status: 400 })

  const admin = serviceClient()
  const { data: rep, error: repError } = await admin
    .from('reps').select('id, name').eq('id', repId).maybeSingle()
  if (repError) return NextResponse.json({ error: repError.message }, { status: 500 })
  if (!rep) return NextResponse.json({ error: 'That rep does not exist.' }, { status: 404 })

  if (body?.action === 'delete') {
    if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const res = await deleteActivity(admin, { id: String(body.id), repId })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
    await auditLog(admin, {
      actorUserId: actor.id, actorEmail: actor.email,
      action: 'rep_activity_delete',
      detail: { rep_id: repId, rep_name: rep.name, activity_id: body.id },
    })
    return NextResponse.json({ success: true })
  }

  const parsed = parseActivityBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // allowReassign: an admin picking a different name in the Rep dropdown means
  // to move the entry, and the update has to carry the new rep_id rather than
  // filter on it. An update scoped by a rep_id the row does not have matches
  // nothing, and Postgres reports no error for updating nothing.
  const res = await saveActivity(admin, {
    id: body?.id || null, repId, fields: parsed.fields, allowReassign: true,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })

  await auditLog(admin, {
    actorUserId: actor.id, actorEmail: actor.email,
    action: body?.id ? 'rep_activity_update' : 'rep_activity_create',
    detail: {
      rep_id: repId, rep_name: rep.name, activity_id: res.id,
      kind: parsed.fields.kind, company: parsed.fields.company, status: parsed.fields.status,
    },
  })

  return NextResponse.json({ success: true, id: res.id, activity: res.row })
}
