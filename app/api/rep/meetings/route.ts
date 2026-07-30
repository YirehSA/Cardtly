import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRepForUser, serviceClient } from '@/lib/rep-access'
import { isMeetingStatus, isMeetingOutcome } from '@/lib/rep-meetings'

// A rep's own meetings.
//
// Every request resolves the caller to a rep record first and then only ever
// touches rows carrying that rep_id. rep_id is never taken from the request -
// if it were, one rep could read or rewrite another's notes by sending someone
// else's id.

function parseBody(body: any): { ok: true; fields: Record<string, any> } | { ok: false; error: string } {
  const company = String(body?.company ?? '').trim()
  if (!company) return { ok: false, error: 'Which company are you seeing?' }
  if (!body?.scheduled_at) return { ok: false, error: 'When is the meeting?' }

  const when = new Date(body.scheduled_at)
  if (!Number.isFinite(when.getTime())) return { ok: false, error: 'That date does not look right.' }

  const status = body?.status ?? 'planned'
  if (!isMeetingStatus(status)) return { ok: false, error: 'Unknown status.' }

  // An outcome only makes sense once the meeting has happened. Storing one
  // against a planned meeting would put "signed up" on something that has not
  // taken place yet.
  let outcome: string | null = body?.outcome || null
  if (outcome && !isMeetingOutcome(outcome)) return { ok: false, error: 'Unknown outcome.' }
  if (status === 'planned') outcome = null

  const text = (v: unknown, max: number) => {
    const s = String(v ?? '').trim()
    return s ? s.slice(0, max) : null
  }

  return {
    ok: true,
    fields: {
      company: company.slice(0, 160),
      contact_name: text(body?.contact_name, 120),
      contact_phone: text(body?.contact_phone, 40),
      contact_email: text(body?.contact_email, 160),
      scheduled_at: when.toISOString(),
      status,
      outcome,
      notes: text(body?.notes, 4000),
      updated_at: new Date().toISOString(),
    },
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = serviceClient()
  const rep = await getRepForUser(admin, user.id)
  if (!rep) return NextResponse.json({ error: 'Not a rep account' }, { status: 403 })

  const { data, error } = await admin
    .from('rep_meetings')
    .select('*')
    .eq('rep_id', rep.id)
    .order('scheduled_at', { ascending: false })

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ error: 'Meetings are not switched on yet: migration 047 has not been run.' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ meetings: data || [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = serviceClient()
  const rep = await getRepForUser(admin, user.id)
  if (!rep) return NextResponse.json({ error: 'Not a rep account' }, { status: 403 })
  if (!rep.active) {
    return NextResponse.json({ error: 'This rep account is no longer active.' }, { status: 403 })
  }

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  // Delete is by id, and scoped to this rep - so an id belonging to someone
  // else simply matches nothing rather than deleting their meeting.
  if (body?.action === 'delete') {
    if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await admin
      .from('rep_meetings').delete().eq('id', body.id).eq('rep_id', rep.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  const parsed = parseBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  if (body?.id) {
    const { error } = await admin
      .from('rep_meetings')
      .update(parsed.fields)
      .eq('id', body.id)
      .eq('rep_id', rep.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, id: body.id })
  }

  const { data, error } = await admin
    .from('rep_meetings')
    .insert({ ...parsed.fields, rep_id: rep.id })
    .select('id')
    .single()

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ error: 'Meetings are not switched on yet: migration 047 has not been run.' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, id: data.id })
}
