import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRepForUser, serviceClient } from '@/lib/rep-access'
import { parseCallBody, saveCall, deleteCall, listCalls } from '@/lib/rep-calls-server'

// A rep's own call log.
//
// Same boundary as their meetings: every request resolves the caller to a rep
// record first and then only ever touches rows carrying that rep_id. rep_id is
// never taken from the request - if it were, one rep could read or rewrite
// another's log by sending someone else's id.
//
// No email goes out from here. A call is a note to yourself; the office copy
// that meetings send exists because a booking is a commitment, and thirty dials
// a day are not.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = serviceClient()
  const rep = await getRepForUser(admin, user.id, user.email)
  if (!rep) return NextResponse.json({ error: 'Not a rep account' }, { status: 403 })

  const res = await listCalls(admin, { repId: rep.id })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ calls: res.calls })
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
    const res = await deleteCall(admin, { id: String(body.id), repId: rep.id })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
    return NextResponse.json({ success: true })
  }

  // An inactive rep keeps their log but stops adding to it - they have left,
  // and what they wrote down is still the company's record.
  if (!rep.active) {
    return NextResponse.json({ error: 'This rep account is no longer active.' }, { status: 403 })
  }

  const parsed = parseCallBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const res = await saveCall(admin, { id: body?.id || null, repId: rep.id, fields: parsed.fields })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })

  return NextResponse.json({ success: true, id: res.id, call: res.row })
}
