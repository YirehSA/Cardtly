import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRepForUser, serviceClient } from '@/lib/rep-access'
import {
  parseActivityBody, saveActivity, deleteActivity, listActivities,
} from '@/lib/rep-activities-server'

// A rep's own outreach log.
//
// Same boundary as their calls and meetings: every request resolves the caller
// to a rep record first and then only ever touches rows carrying that rep_id.
// rep_id is never taken from the request - if it were, one rep could read or
// rewrite another's log by sending someone else's id.
//
// Nothing is emailed from here. Logging that you sent an email is a note to
// yourself; sending a second one from Cardtly on top of it would be the last
// thing anybody wanted.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = serviceClient()
  const rep = await getRepForUser(admin, user.id, user.email)
  if (!rep) return NextResponse.json({ error: 'Not a rep account' }, { status: 403 })

  const res = await listActivities(admin, { repId: rep.id })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ activities: res.activities })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = serviceClient()
  const rep = await getRepForUser(admin, user.id, user.email)
  if (!rep) return NextResponse.json({ error: 'Not a rep account' }, { status: 403 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  if (body?.action === 'delete') {
    if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const res = await deleteActivity(admin, { id: String(body.id), repId: rep.id })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
    return NextResponse.json({ success: true })
  }

  // An inactive rep keeps their log but stops adding to it - they have left,
  // and what they wrote down is still the company's record.
  if (!rep.active) {
    return NextResponse.json({ error: 'This rep account is no longer active.' }, { status: 403 })
  }

  const parsed = parseActivityBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const res = await saveActivity(admin, { id: body?.id || null, repId: rep.id, fields: parsed.fields })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })

  return NextResponse.json({ success: true, id: res.id, activity: res.row })
}
