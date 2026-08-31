import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin-check'
import { serviceClient } from '@/lib/rep-access'
import { auditLog } from '@/lib/admin-audit'
import { parseMeetingBody, saveMeeting, deleteMeeting, listMeetings } from '@/lib/rep-meetings-server'
import { notifyMeetingChange, describeInvite } from '@/lib/meeting-invite'

// Every rep's meetings, for the admin calendar.
//
// The rep route resolves rep_id from the session because a rep may only ever
// touch their own. An admin is the opposite case: they are looking at everyone,
// so rep_id has to come from the request. That is safe here for one reason only
// - isAdminUser has already been checked - and it is verified against the reps
// table before anything is written, so a typo cannot create an orphan row.
//
// Admin writes are audited. A rep's notes are their record of their own work,
// and someone else changing them should be traceable.

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
  const res = await listMeetings(admin)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })

  // Names come along so the calendar can label and colour by rep without a
  // second round trip.
  const { data: reps } = await admin.from('reps').select('id, name, active').order('name')

  return NextResponse.json({ meetings: res.meetings, reps: reps || [] })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error
  const actor = gate.user

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const repId = String(body?.rep_id || '').trim()
  if (!repId) return NextResponse.json({ error: 'Choose which rep this meeting belongs to.' }, { status: 400 })

  const admin = serviceClient()
  const { data: rep, error: repError } = await admin
    .from('reps').select('id, name').eq('id', repId).maybeSingle()
  if (repError) return NextResponse.json({ error: repError.message }, { status: 500 })
  if (!rep) return NextResponse.json({ error: 'That rep does not exist.' }, { status: 404 })

  if (body?.action === 'delete') {
    if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const res = await deleteMeeting(admin, { id: String(body.id), repId })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
    const notified = await notifyMeetingChange(admin, { meeting: res.row, deleted: true })
    await auditLog(admin, {
      actorUserId: actor.id, actorEmail: actor.email,
      action: 'rep_meeting_delete',
      detail: { rep_id: repId, rep_name: rep.name, meeting_id: body.id, emailed: notified.sent },
    })
    return NextResponse.json({ success: true, notified: describeInvite(notified) })
  }

  const parsed = parseMeetingBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // allowReassign: an admin picking a different name in the Rep dropdown means
  // to move the meeting, and the update has to carry the new rep_id rather than
  // filter on it.
  const res = await saveMeeting(admin, {
    id: body?.id || null, repId, fields: parsed.fields, allowReassign: true,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })

  // Booking on a rep's behalf sends exactly what the rep booking it themselves
  // would send - to the rep as well, since they were not the one who did it.
  const notified = await notifyMeetingChange(admin, { meeting: res.row, previous: res.previous })

  await auditLog(admin, {
    actorUserId: actor.id, actorEmail: actor.email,
    action: body?.id ? 'rep_meeting_update' : 'rep_meeting_create',
    detail: {
      rep_id: repId, rep_name: rep.name, meeting_id: res.id,
      company: parsed.fields.company, scheduled_at: parsed.fields.scheduled_at,
      emailed: notified.sent,
    },
  })

  return NextResponse.json({
    success: true,
    id: res.id,
    notified: describeInvite(notified),
    warning: res.degraded
      ? 'Saved. The length, location and follow-up date need migration 048 before they can be stored.'
      : null,
  })
}
