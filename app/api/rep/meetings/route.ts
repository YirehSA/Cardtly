import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRepForUser, serviceClient } from '@/lib/rep-access'
import { parseMeetingBody, saveMeeting, deleteMeeting, listMeetings } from '@/lib/rep-meetings-server'

// A rep's own meetings.
//
// Every request resolves the caller to a rep record first and then only ever
// touches rows carrying that rep_id. rep_id is never taken from the request -
// if it were, one rep could read or rewrite another's notes by sending someone
// else's id. The validation and the migration tolerance live in
// lib/rep-meetings-server, shared with the admin route.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = serviceClient()
  const rep = await getRepForUser(admin, user.id, user.email)
  if (!rep) return NextResponse.json({ error: 'Not a rep account' }, { status: 403 })

  const res = await listMeetings(admin, { repId: rep.id })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ meetings: res.meetings })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = serviceClient()
  const rep = await getRepForUser(admin, user.id, user.email)
  if (!rep) return NextResponse.json({ error: 'Not a rep account' }, { status: 403 })
  if (!rep.active) {
    return NextResponse.json({ error: 'This rep account is no longer active.' }, { status: 403 })
  }

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  if (body?.action === 'delete') {
    if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const res = await deleteMeeting(admin, { id: String(body.id), repId: rep.id })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
    return NextResponse.json({ success: true })
  }

  const parsed = parseMeetingBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const res = await saveMeeting(admin, { id: body?.id || null, repId: rep.id, fields: parsed.fields })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })

  // Said out loud rather than swallowed: the meeting saved, but the length,
  // location and follow-up date did not, because the column is not there yet.
  return NextResponse.json({
    success: true,
    id: res.id,
    warning: res.degraded
      ? 'Saved. The length, location and follow-up date need migration 048 before they can be stored.'
      : null,
  })
}
